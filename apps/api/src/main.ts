import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Module,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request, Response, json } from "express";
import helmet from "helmet";
import { ZodError, z } from "zod";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pool, migrate, one, rows, tx, readTx } from "./db";
import {
  authenticate,
  demoAccounts,
  demoLogin,
  digest,
  login,
  register,
} from "./auth";
import * as social from "./social";
import * as discovery from "./discovery";
import * as games from "./games";
import * as gamesV2 from "./game-v2";
import * as identity from "./identity";
import * as moments from "./moments";
import { exportAccount } from "./account-export";
import * as interactions from "./interactions";
import {
  cleanup,
  upload,
  reserveUpload,
  queueMediaDeletion,
  drainMediaDeletions,
  sendAuthorizedMedia,
} from "./media";
import {
  requestScope,
  enforceIpLimit,
  enforceActorLimit,
  actionForRoute,
  RateLimitExceeded,
  purgeRateLimits,
} from "./rate-limit";
import { seed } from "./seed";
import { dispatchPush } from "./push";
import { text, uuid } from "./validation";
import { metricsSnapshot, requestMetrics } from "./observability";
type AuthRequest = Request & { actor: string };

@Controller()
class ApiController {
  @Get("health") health() {
    return { status: "ok", app: "Sangai local beta", ai: false };
  }
  @Get("ready") async readinessHealth(@Res() res: Response) {
    try {
      await pool.query("SELECT 1");
      return res.json({ status: "ready" });
    } catch {
      return res.status(503).json({ status: "unavailable" });
    }
  }
  @Get("v1/admin/metrics") async metrics() {
    const jobs = await one(
      pool,
      "SELECT count(*)::int AS pending,count(*) FILTER(WHERE next_attempt_at<=now())::int AS due,count(*) FILTER(WHERE last_error IS NOT NULL)::int AS retrying FROM media_deletion_jobs",
    );
    return { ...metricsSnapshot(), mediaDeletionJobs: jobs };
  }
  @Get("policies") policies(@Res() res: Response) {
    res
      .type("html")
      .send(
        '<!doctype html><title>Sangai beta policies</title><main style="max-width:700px;margin:60px auto;font:18px system-ui"><h1>Sangai private beta</h1><p>Adults 18+ only. Use test accounts and non-sensitive content in this local beta. Do not upload explicit, illegal, harassing, impersonating or exploitative material. Report abuse from any profile or chat.</p><h2>Privacy</h2><p>Discovery shows your selected profile fields. Posts and stories are only for current mutual matches. Data is stored on the configured backend. This beta has no AI, advertising, biometric verification or analytics trackers. It uses server-readable messages, not end-to-end encryption. Snaps expire but screenshots cannot be prevented.</p><h2>Your controls</h2><p>Pause discovery, block people, export your data or delete your account from Profile. Deletion removes live account data and media. Backups, if made by the local operator, need separate deletion. Reports and minimal moderation records may remain for review.</p><h2>Contact and operation</h2><p>This is an emulator/private testing build, not a publicly moderated service. Contact the person running your beta server. A staffed safety contact, legal review, hardened authentication and published production policies are required before public release.</p></main>',
      );
  }
  @Get("admin") adminPage(@Res() res: Response) {
    res
      .type("html")
      .send(readFileSync(join(__dirname, "../src/admin.html"), "utf8"));
  }
  @Get("admin.js") adminScript(@Res() res: Response) {
    res
      .type("application/javascript")
      .send(readFileSync(join(__dirname, "../src/admin.js"), "utf8"));
  }
  @Get("v1/auth/demo") demo() {
    return demoAccounts();
  }
  @Post("v1/auth/demo") demoSignIn(@Body() b: any) {
    return demoLogin(uuid.parse(b.id));
  }
  @Post("v1/auth/register") register(@Body() b: unknown) {
    return register(b);
  }
  @Post("v1/auth/login") login(@Body() b: any) {
    const d = z
      .object({ email: z.email().max(254), password: z.string().max(128) })
      .parse(b);
    return login(d.email, d.password);
  }
  @Get("v1/auth/config") authConfig() {
    return identity.authConfig();
  }
  @Post("v1/auth/google") google(@Body() b: any) {
    return identity.googleSignIn(z.string().min(1).max(10000).parse(b.idToken));
  }
  @Post("v1/auth/forgot") forgot(@Body() b: any) {
    return identity.forgot(z.email().max(254).parse(b.email));
  }
  @Post("v1/auth/reset") reset(@Body() b: any) {
    const p = z
      .object({
        email: z.email().max(254),
        code: text(100),
        password: z.string().min(10).max(128),
      })
      .parse(b);
    return identity.reset(p.email, p.code, p.password);
  }
  @Post("v1/verification/send") sendVerification(@Req() r: AuthRequest) {
    return identity.sendVerification(r.actor);
  }
  @Post("v1/verification/confirm") verify(
    @Req() r: AuthRequest,
    @Body() b: any,
  ) {
    return identity.verifyEmail(r.actor, text(100).parse(b.code));
  }
  @Patch("v1/onboarding") onboarding(
    @Req() r: AuthRequest,
    @Body() b: unknown,
  ) {
    return identity.onboarding(r.actor, b);
  }
  @Post("v1/logout") async logout(@Req() r: AuthRequest) {
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      digest(r.headers.authorization!.slice(7)),
    ]);
    await pool.query("UPDATE users SET push_token=NULL WHERE id=$1", [r.actor]);
    return { ok: true };
  }
  @Post("v1/device") async device(@Req() r: AuthRequest, @Body() b: any) {
    const token = z
      .string()
      .regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)
      .max(200)
      .parse(b.token);
    await tx(async (db) => {
      await db.query("UPDATE users SET push_token=NULL WHERE push_token=$1", [
        token,
      ]);
      await db.query("UPDATE users SET push_token=$2 WHERE id=$1", [
        r.actor,
        token,
      ]);
    });
    return { ok: true };
  }
  @Get("v1/state") state(@Req() r: AuthRequest) {
    return social.state(r.actor);
  }
  @Get("v1/feed") getFeed(
    @Req() r: AuthRequest,
    @Query("before") before?: string,
    @Query("beforeId") beforeId?: string,
    @Query("scope") scope?: string,
  ) {
    if (before) z.iso.datetime({ offset: true }).parse(before);
    if (beforeId) uuid.parse(beforeId);
    if (scope) z.enum(["all", "mine"]).parse(scope);
    return readTx((db) =>
      social.feed(db, r.actor, before, beforeId, scope === "mine"),
    );
  }
  @Get("v1/matches") matchesPage(
    @Req() r: AuthRequest,
    @Query("afterName") name?: string,
    @Query("afterId") id?: string,
    @Query("limit") limit?: string,
  ) {
    if (name !== undefined) z.string().max(100).parse(name);
    if (id) uuid.parse(id);
    return social.matchesPage(
      r.actor,
      name,
      id,
      limit === undefined
        ? 30
        : z.coerce.number().int().min(1).max(50).parse(limit),
    );
  }
  @Get("v1/stories") storiesPage(
    @Req() r: AuthRequest,
    @Query("before") before?: string,
    @Query("beforeId") id?: string,
    @Query("limit") limit?: string,
  ) {
    if (before) z.iso.datetime({ offset: true }).parse(before);
    if (id) uuid.parse(id);
    return social.storiesPage(
      r.actor,
      before,
      id,
      limit === undefined
        ? 30
        : z.coerce.number().int().min(1).max(50).parse(limit),
    );
  }
  @Get("v1/notifications") notificationsPage(
    @Req() r: AuthRequest,
    @Query("before") before?: string,
    @Query("beforeId") id?: string,
    @Query("limit") limit?: string,
  ) {
    if (before) z.iso.datetime({ offset: true }).parse(before);
    if (id) uuid.parse(id);
    return social.notificationsPage(
      r.actor,
      before,
      id,
      limit === undefined
        ? 30
        : z.coerce.number().int().min(1).max(50).parse(limit),
    );
  }
  @Patch("v1/profile") profile(@Req() r: AuthRequest, @Body() b: unknown) {
    return social.updateProfile(r.actor, b);
  }
  @Patch("v1/settings") async settings(@Req() r: AuthRequest, @Body() b: any) {
    const d = z
      .object({
        paused: z.boolean().optional(),
        notifications: z.boolean().optional(),
        posts_visible: z.boolean().optional(),
        stories_visible: z.boolean().optional(),
        messages_enabled: z.boolean().optional(),
        interactions_enabled: z.boolean().optional(),
        data_saver: z.boolean().optional(),
      })
      .parse(b);
    await pool.query(
      "UPDATE users SET paused=COALESCE($2,paused),notifications=COALESCE($3,notifications),posts_visible=COALESCE($4,posts_visible),stories_visible=COALESCE($5,stories_visible),messages_enabled=COALESCE($6,messages_enabled),interactions_enabled=COALESCE($7,interactions_enabled),data_saver=COALESCE($8,data_saver) WHERE id=$1",
      [
        r.actor,
        d.paused ?? null,
        d.notifications ?? null,
        d.posts_visible ?? null,
        d.stories_visible ?? null,
        d.messages_enabled ?? null,
        d.interactions_enabled ?? null,
        d.data_saver ?? null,
      ],
    );
    return { ok: true };
  }
  @Post("v1/profile/photo") photo(@Req() r: AuthRequest, @Body() b: any) {
    return tx(async (db) => {
      const id = uuid.parse(b.mediaId);
      await social.ownMedia(db, r.actor, id, "profile");
      const m = await one(db, "SELECT kind FROM media WHERE id=$1", [id]);
      if (m.kind !== "image")
        throw new BadRequestException("Profile photos must be images.");
      const gallery = await one(
        db,
        "SELECT count(*)::int AS n FROM profile_media WHERE user_id=$1 AND media_id<>$2",
        [r.actor, id],
      );
      if (gallery.n >= 6)
        throw new BadRequestException(
          "Remove a gallery item before adding another main photo.",
        );
      await db.query("UPDATE users SET avatar_id=$2 WHERE id=$1", [
        r.actor,
        id,
      ]);
      await db.query(
        "INSERT INTO profile_media(user_id,media_id,position) VALUES($1,$2,0) ON CONFLICT DO NOTHING",
        [r.actor, id],
      );
      return { ok: true };
    });
  }
  @Post("v1/profile/media") addProfileMedia(
    @Req() r: AuthRequest,
    @Body() b: any,
  ) {
    return tx(async (db) => {
      const id = uuid.parse(b.mediaId);
      await social.ownMedia(db, r.actor, id, "profile");
      const count = await one(
        db,
        "SELECT count(*)::int AS n FROM profile_media WHERE user_id=$1",
        [r.actor],
      );
      if (count.n >= 6)
        throw new BadRequestException(
          "Keep up to six profile photos or videos. Remove one first.",
        );
      await db.query(
        "INSERT INTO profile_media(user_id,media_id,position) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [r.actor, id, count.n],
      );
      return { ok: true };
    });
  }
  @Delete("v1/profile/media/:id") deleteProfileMedia(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    return tx(async (db) => {
      const mediaId = uuid.parse(id);
      const u = await one(db, "SELECT avatar_id FROM users WHERE id=$1", [
        r.actor,
      ]);
      if (u.avatar_id === mediaId)
        throw new BadRequestException(
          "Choose another main photo before removing this one.",
        );
      await db.query(
        "DELETE FROM profile_media WHERE user_id=$1 AND media_id=$2",
        [r.actor, mediaId],
      );
      return { ok: true };
    });
  }
  @Get("v1/profiles/:target") visibleProfile(
    @Req() r: AuthRequest,
    @Param("target") t: string,
  ) {
    return discovery.visibleProfile(r.actor, uuid.parse(t));
  }
  @Post("v1/discovery/:target") swipe(
    @Req() r: AuthRequest,
    @Param("target") t: string,
    @Body() b: unknown,
  ) {
    return discovery.swipe(r.actor, uuid.parse(t), b);
  }
  @Post("v1/discovery-undo/:id") undo(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    return discovery.undo(r.actor, uuid.parse(id));
  }
  @Post("v1/unmatch/:target") unmatch(
    @Req() r: AuthRequest,
    @Param("target") t: string,
  ) {
    return social.disconnect(r.actor, uuid.parse(t), false);
  }
  @Post("v1/block/:target") block(
    @Req() r: AuthRequest,
    @Param("target") t: string,
  ) {
    return social.disconnect(r.actor, uuid.parse(t), true);
  }
  @Get("v1/blocks") blocks(@Req() r: AuthRequest) {
    return rows(
      pool,
      "SELECT u.id,u.name FROM blocks b JOIN users u ON u.id=b.target WHERE b.actor=$1",
      [r.actor],
    );
  }
  @Delete("v1/block/:target") async unblock(
    @Req() r: AuthRequest,
    @Param("target") t: string,
  ) {
    await pool.query("DELETE FROM blocks WHERE actor=$1 AND target=$2", [
      r.actor,
      uuid.parse(t),
    ]);
    return { ok: true };
  }
  @Post("v1/posts") post(@Req() r: AuthRequest, @Body() b: unknown) {
    return social.createPost(r.actor, b);
  }
  @Delete("v1/posts/:id") async deletePost(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    await pool.query("DELETE FROM posts WHERE id=$1 AND author=$2", [
      uuid.parse(id),
      r.actor,
    ]);
    return { ok: true };
  }
  @Get("v1/posts/:id") postDetail(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    return readTx((db) => moments.postDetail(db, r.actor, uuid.parse(id)));
  }
  @Get("v1/saved-posts") saved(@Req() r: AuthRequest) {
    return moments.saved(r.actor);
  }
  @Post("v1/posts/:id/save") save(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return moments.save(r.actor, uuid.parse(id), z.boolean().parse(b.enabled));
  }
  @Post("v1/posts/:id/share") share(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return moments.share(
      r.actor,
      uuid.parse(id),
      uuid.parse(b.target),
      uuid.parse(b.clientId),
    );
  }
  @Post("v1/posts/:id/react") react(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    return social.react(r.actor, uuid.parse(id));
  }
  @Post("v1/posts/:id/comments") comment(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return social.comment(
      r.actor,
      uuid.parse(id),
      text(500).parse(b.body),
      b.parentId ? uuid.parse(b.parentId) : undefined,
    );
  }
  @Post("v1/stories") story(@Req() r: AuthRequest, @Body() b: unknown) {
    return social.createStory(r.actor, b);
  }
  @Delete("v1/stories/:id") async deleteStory(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    await pool.query("DELETE FROM stories WHERE id=$1 AND author=$2", [
      uuid.parse(id),
      r.actor,
    ]);
    return { ok: true };
  }
  @Get("v1/chat/:target") chat(
    @Req() r: AuthRequest,
    @Param("target") t: string,
    @Query("before") before?: string,
    @Query("beforeId") beforeId?: string,
  ) {
    if (before) z.iso.datetime({ offset: true }).parse(before);
    if (beforeId) uuid.parse(beforeId);
    return interactions.conversation(r.actor, uuid.parse(t), before, beforeId);
  }
  @Post("v1/chat/:target") message(
    @Req() r: AuthRequest,
    @Param("target") t: string,
    @Body() b: unknown,
  ) {
    return interactions.sendMessage(r.actor, uuid.parse(t), b);
  }
  @Post("v1/snaps/:target") snap(
    @Req() r: AuthRequest,
    @Param("target") t: string,
    @Body() b: unknown,
  ) {
    return interactions.sendSnap(r.actor, uuid.parse(t), b);
  }
  @Post("v1/snaps/:id/open") openSnap(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    return interactions.openSnap(r.actor, uuid.parse(id));
  }
  @Post("v1/snaps/:id/close") closeSnap(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    return interactions.closeSnap(r.actor, uuid.parse(id));
  }
  @Post("v1/game-ready/:target") ready(
    @Req() r: AuthRequest,
    @Param("target") t: string,
    @Body() b: any,
  ) {
    return games.setReady(r.actor, uuid.parse(t), z.boolean().parse(b.enabled));
  }
  @Get("v1/game-ready/:target") getReady(
    @Req() r: AuthRequest,
    @Param("target") t: string,
  ) {
    return tx((db) => games.readiness(db, r.actor, uuid.parse(t)));
  }
  @Post("v1/game/:id/respond") gameResponse(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return games.respond(r.actor, uuid.parse(id), text(20).parse(b.response));
  }
  @Post("v1/game/:id/guess") gameGuess(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return games.guess(r.actor, uuid.parse(id), b.guess);
  }
  @Post("v1/games/:target") game(
    @Req() r: AuthRequest,
    @Param("target") t: string,
    @Body() b: any,
  ) {
    return games.invite(r.actor, uuid.parse(t), text(40).parse(b.kind));
  }
  @Get("v1/game-catalog") gameCatalog(
    @Req() r: AuthRequest,
    @Query("target") target?: string,
  ) {
    return gamesV2.catalog(r.actor, target ? uuid.parse(target) : undefined);
  }
  @Post("v1/games/:target/invite") gameInviteV2(
    @Req() r: AuthRequest,
    @Param("target") target: string,
    @Body() body: unknown,
  ) {
    return gamesV2.invite(r.actor, uuid.parse(target), body);
  }
  @Get("v1/game/:id") gameReadV2(
    @Req() r: AuthRequest,
    @Param("id") id: string,
  ) {
    return gamesV2.read(r.actor, uuid.parse(id));
  }
  @Post("v1/game/:id/action") gameActionV2(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return gamesV2.action(r.actor, uuid.parse(id), body);
  }
  @Post("v1/game/:id/answer") gameAnswer(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return games.answer(r.actor, uuid.parse(id), b.answers);
  }
  @Post("v1/plans/:target") plan(
    @Req() r: AuthRequest,
    @Param("target") t: string,
    @Body() b: unknown,
  ) {
    return interactions.proposeDate(r.actor, uuid.parse(t), b);
  }
  @Post("v1/plan/:id") answerPlan(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return interactions.answerDate(
      r.actor,
      uuid.parse(id),
      text(20).parse(b.state),
    );
  }
  @Post("v1/reports") report(@Req() r: AuthRequest, @Body() b: any) {
    const d = z
      .object({
        target: uuid,
        reason: text(300),
        context: z.string().max(500).optional(),
        gameId: uuid.optional(),
      })
      .parse(b);
    return tx(async (db) => {
      const id = randomUUID();
      if (!(await one(db, "SELECT 1 FROM users WHERE id=$1", [d.target])))
        throw new BadRequestException();
      let context = d.context || "";
      if (d.gameId) {
        const game = await one(
          db,
          "SELECT id,host,guest,kind,state FROM games WHERE id=$1 AND (host=$2 OR guest=$2)",
          [d.gameId, r.actor],
        );
        if (
          !game ||
          (game.host === r.actor ? game.guest : game.host) !== d.target
        )
          throw new BadRequestException(
            "That game is not part of your conversation.",
          );
        context = `game:${game.id}; kind:${game.kind}; state:${game.state}`;
      }
      await db.query(
        "INSERT INTO reports(id,reporter,target,reason,context) VALUES($1,$2,$3,$4,$5)",
        [id, r.actor, d.target, d.reason, context],
      );
      return { id };
    });
  }
  @Get("v1/reports") myReports(@Req() r: AuthRequest) {
    return rows(
      pool,
      "SELECT id,reason,state,resolution,created_at FROM reports WHERE reporter=$1 ORDER BY created_at DESC",
      [r.actor],
    );
  }
  @Post("v1/notifications/read") async read(@Req() r: AuthRequest) {
    await pool.query("UPDATE notifications SET read=true WHERE recipient=$1", [
      r.actor,
    ]);
    return { ok: true };
  }
  @Get("v1/export") exportData(@Req() r: AuthRequest) {
    return exportAccount(r.actor);
  }
  @Delete("v1/account") async deleteAccount(
    @Req() r: AuthRequest,
    @Body() b: any,
  ) {
    if (b.confirm !== "DELETE")
      throw new BadRequestException("Confirmation required.");
    const result = await tx(async (db) => {
      const files = await rows(db, "SELECT path FROM media WHERE owner=$1", [
        r.actor,
      ]);
      await queueMediaDeletion(
        db,
        files.map((file) => file.path),
      );
      await db.query("DELETE FROM users WHERE id=$1", [r.actor]);
      return { ok: true };
    });
    await drainMediaDeletions().catch(() =>
      console.error("Media deletion drain deferred; durable jobs retained"),
    );
    return result;
  }
  @Post("v1/media")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    }),
  )
  media(@Req() r: AuthRequest, @UploadedFile() f: Express.Multer.File) {
    return upload(r.actor, f);
  }
  @Get("v1/media/:id") async getMedia(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Query("thumbnail") thumbnail: string,
    @Res() res: Response,
  ) {
    return sendAuthorizedMedia(r.actor, uuid.parse(id), thumbnail === "1", res);
  }
  @Get("v1/admin/reports") adminReports() {
    return rows(
      pool,
      "SELECT r.*,u.name AS target_name FROM reports r LEFT JOIN users u ON u.id=r.target ORDER BY r.created_at DESC LIMIT 200",
    );
  }
  @Post("v1/admin/reports/:id") async adminAction(
    @Param("id") id: string,
    @Body() b: any,
  ) {
    const d = z
      .object({
        action: z.enum(["dismiss", "resolve", "suspend"]),
        resolution: text(500),
      })
      .parse(b);
    return tx(async (db) => {
      const report = await one(db, "SELECT * FROM reports WHERE id=$1", [
        uuid.parse(id),
      ]);
      if (!report) throw new BadRequestException();
      await db.query("UPDATE reports SET state=$2,resolution=$3 WHERE id=$1", [
        id,
        d.action === "dismiss" ? "dismissed" : "resolved",
        d.resolution,
      ]);
      if (d.action === "suspend" && report.target) {
        await db.query("UPDATE users SET suspended=true WHERE id=$1", [
          report.target,
        ]);
        await db.query("DELETE FROM sessions WHERE user_id=$1", [
          report.target,
        ]);
      }
      await db.query("INSERT INTO audit(id,action,target) VALUES($1,$2,$3)", [
        randomUUID(),
        d.action,
        report.target,
      ]);
      return { ok: true };
    });
  }
}
@Module({ controllers: [ApiController] })
class AppModule {}

export async function bootstrap() {
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "This local beta is not approved for public production. Read docs/beta.md.",
    );
  await migrate();
  await seed();
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
    bodyParser: false,
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  const approvedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed: boolean) => void,
    ) =>
      callback(
        null,
        !origin ||
          /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(
            origin,
          ) ||
          approvedOrigins.includes(origin),
      ),
    credentials: false,
    exposedHeaders: ["Retry-After", "X-Request-ID"],
  });
  app.use(json({ limit: "32kb" }));
  app.use(requestMetrics);
  app.use(async (req: AuthRequest, res: Response, next: any) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const routePath = req.path.toLowerCase().replace(/\/+$/, "");
      if (!routePath.startsWith("/v1")) return next();
      await enforceIpLimit(
        req.ip || "unknown",
        requestScope(req.method, routePath),
      );
      if (routePath.startsWith("/v1/admin")) {
        const expected = process.env.ADMIN_KEY || "";
        const actual = String(req.headers["x-admin-key"] || "");
        if (
          expected.length < 16 ||
          actual.length !== expected.length ||
          !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
        )
          throw new UnauthorizedException();
        return next();
      }
      if (routePath.startsWith("/v1/auth")) return next();
      req.actor = await authenticate(req.headers.authorization);
      const setupRoutes = [
        "/v1/state",
        "/v1/logout",
        "/v1/onboarding",
        "/v1/verification/send",
        "/v1/verification/confirm",
        "/v1/account",
        "/v1/export",
        "/v1/media",
        "/v1/profile/photo",
      ];
      if (
        !setupRoutes.includes(routePath) &&
        !/^\/v1\/media\/[a-f0-9-]+$/.test(routePath)
      )
        await identity.requireReadyAccount(req.actor);
      if (
        req.method === "POST" &&
        ["/v1/media", "/v1/profile/photo"].includes(routePath)
      ) {
        const adult = await one(
          pool,
          "SELECT 1 FROM users WHERE id=$1 AND (demo OR (adult_declared_at IS NOT NULL AND email_verified_at IS NOT NULL))",
          [req.actor],
        );
        if (!adult)
          throw new BadRequestException(
            "Verify your email and complete the adult declaration before adding photos.",
          );
      }
      const action = actionForRoute(req.method, routePath);
      if (action) await enforceActorLimit(req.actor, action);
      if (req.method === "POST" && routePath === "/v1/media") {
        const release = reserveUpload(req.actor);
        res.once("finish", release);
        res.once("close", release);
      }
      next();
    } catch (e) {
      if (e instanceof RateLimitExceeded)
        res.setHeader("Retry-After", e.retryAfterSeconds);
      res.status(e instanceof HttpException ? e.getStatus() : 500).json({
        message: e instanceof HttpException ? e.message : "Request failed.",
      });
    }
  });
  app.useGlobalFilters({
    catch(error: any, host: any) {
      const res = host.switchToHttp().getResponse() as Response;
      if (error instanceof ZodError)
        return res
          .status(400)
          .json({ message: error.issues.map((i) => i.message).join("; ") });
      const status = error instanceof HttpException ? error.getStatus() : 500;
      if (error instanceof RateLimitExceeded)
        res.setHeader("Retry-After", error.retryAfterSeconds);
      if (status === 500)
        console.error("API failure", error.code || error.name);
      res.status(status).json({
        message:
          status === 500 ? "Request failed. Please try again." : error.message,
      });
    },
  });
  await app.listen(Number(process.env.PORT || 4100), "0.0.0.0");
  const timer = setInterval(
    () =>
      Promise.all([
        cleanup(),
        purgeRateLimits(),
        gamesV2.reconcileExpiredGamesV2(),
      ]).catch(() => console.error("Maintenance failed")),
    60000,
  );
  timer.unref();
  const pushTimer = setInterval(
    () => dispatchPush().catch(() => console.error("Push dispatch failed")),
    15000,
  );
  pushTimer.unref();
  const shutdown = async () => {
    clearInterval(timer);
    clearInterval(pushTimer);
    await app.close();
    await pool.end();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return app;
}
if (require.main === module)
  bootstrap().catch((e) => {
    console.error(e);
    process.exit(1);
  });
