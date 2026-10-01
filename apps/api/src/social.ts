import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  DB,
  matched,
  matchVisibilitySql,
  one,
  pool,
  publicFields,
  readTx,
  requireMatch,
  rows,
  tx,
} from "./db";
import { gameCatalog, profileInput, text, uuid } from "./validation";
import { z } from "zod";
import { projectPosts } from "./moments";
import { candidates, lastUndo } from "./discovery";
import { accountReady, privateProfileFields } from "./identity";
import { gamesV2Enabled } from "./game-v2";

export async function notify(
  db: DB,
  recipient: string,
  actor: string,
  kind: string,
  body: string,
) {
  await db.query(
    "INSERT INTO notifications(id,recipient,actor,kind,body) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), recipient, actor, kind, body],
  );
}
export async function ownMedia(
  db: DB,
  actor: string,
  id?: string | null,
  purpose = "post",
) {
  if (!id) return;
  uuid.parse(id);
  if (
    !(await one(db, "SELECT 1 FROM media WHERE id=$1 AND owner=$2", [
      id,
      actor,
    ]))
  )
    throw new ForbiddenException("Choose your own uploaded media.");
  const claimed = await db.query(
    "UPDATE media SET purpose=$3 WHERE id=$1 AND owner=$2 AND (purpose='' OR purpose=$3) RETURNING id",
    [id, actor, purpose],
  );
  if (!claimed.rowCount)
    throw new ForbiddenException(
      "Upload a new copy for this audience. Private snap/chat media cannot become a post or profile photo.",
    );
}
export async function allowedPost(db: DB, actor: string, id: string) {
  const p = await one(
    db,
    "SELECT p.* FROM posts p JOIN users u ON u.id=p.author WHERE p.id=$1 AND (p.author=$2 OR u.posts_visible)",
    [id, actor],
  );
  if (!p || !(await matched(db, actor, p.author)))
    throw new NotFoundException("Post unavailable.");
  return p;
}
export async function feed(
  db: DB,
  actor: string,
  before?: string,
  beforeId?: string,
  ownOnly = false,
) {
  const candidates = await rows(
    db,
    `SELECT p.*,m.kind,to_char(p.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at FROM posts p LEFT JOIN media m ON m.id=p.media_id JOIN users u ON u.id=p.author WHERE (NOT $4::boolean OR p.author=$1) AND NOT u.suspended AND (p.author=$1 OR u.posts_visible) AND ($2::timestamptz IS NULL OR (p.created_at,p.id)<($2::timestamptz,COALESCE($3::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))) AND ${matchVisibilitySql("$1::uuid", "p.author")} ORDER BY p.created_at DESC,p.id DESC LIMIT 30`,
    [actor, before || null, beforeId || null, ownOnly],
  );
  return projectPosts(db, actor, candidates);
}
async function matchRows(
  db: DB,
  actor: string,
  afterName?: string,
  afterId?: string,
  limit?: number,
) {
  return rows(
    db,
    `SELECT ${publicFields} FROM users u WHERE u.id<>$1
      AND ${matchVisibilitySql("$1::uuid", "u.id")}
      AND ($2::text IS NULL OR (u.name,u.id)>($2::text,$3::uuid))
    ORDER BY u.name,u.id LIMIT $4`,
    [actor, afterName ?? null, afterId ?? null, limit ?? null],
  );
}
async function projectMatches(db: DB, actor: string, people: any[]) {
  if (!people.length) return [];
  const ids = people.map((p) => p.id);
  const unread = await rows(
    db,
    "SELECT sender,count(*)::int AS unread FROM messages WHERE recipient=$1 AND sender=ANY($2::uuid[]) AND read_at IS NULL GROUP BY sender",
    [actor, ids],
  );
  const previews = await rows(
    db,
    `SELECT DISTINCT ON (other_id) other_id,
      CASE WHEN media_id IS NOT NULL THEN 'Photo or video'
           WHEN post_id IS NOT NULL THEN 'Shared moment' ELSE body END AS body
    FROM messages CROSS JOIN LATERAL (
      SELECT CASE WHEN sender=$1 THEN recipient ELSE sender END AS other_id
    ) other
    WHERE (sender=$1 OR recipient=$1) AND other_id=ANY($2::uuid[])
    ORDER BY other_id,created_at DESC,id DESC`,
    [actor, ids],
  );
  const unreadById = new Map(unread.map((m) => [m.sender, m.unread]));
  const previewById = new Map(previews.map((m) => [m.other_id, m.body]));
  return people.map((p) => ({
    ...p,
    unread: unreadById.get(p.id) || 0,
    preview: previewById.get(p.id) || "You chose each other. Say hello.",
  }));
}
async function storyRows(
  db: DB,
  actor: string,
  limit: number,
  before?: string,
  beforeId?: string,
) {
  return rows(
    db,
    `SELECT s.*,m.kind,to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at
    FROM stories s LEFT JOIN media m ON m.id=s.media_id
    JOIN users u ON u.id=s.author
    WHERE s.expires_at>now() AND NOT u.suspended
      AND (s.author=$1 OR u.stories_visible)
      AND ${matchVisibilitySql("$1::uuid", "s.author")}
      AND ($2::timestamptz IS NULL OR (s.created_at,s.id)<($2::timestamptz,$3::uuid))
    ORDER BY s.created_at DESC,s.id DESC LIMIT $4`,
    [actor, before ?? null, beforeId ?? null, limit],
  );
}
async function projectStories(db: DB, stories: any[]) {
  if (!stories.length) return [];
  const people = await rows(
    db,
    `SELECT ${publicFields} FROM users WHERE id=ANY($1::uuid[]) AND NOT suspended`,
    [Array.from(new Set(stories.map((s) => s.author)))],
  );
  const peopleById = new Map(people.map((p) => [p.id, p]));
  return stories.map(({ cursor_created_at, ...s }) => ({
    ...s,
    author: peopleById.get(s.author),
  }));
}
async function notificationRows(
  db: DB,
  actor: string,
  limit: number,
  before?: string,
  beforeId?: string,
) {
  return rows(
    db,
    `SELECT n.*,to_char(n.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at
    FROM notifications n WHERE n.recipient=$1 AND n.actor<>$1 AND n.kind<>'request'
      AND ${matchVisibilitySql("$1::uuid", "n.actor")}
      AND ($2::timestamptz IS NULL OR (n.created_at,n.id)<($2::timestamptz,$3::uuid))
    ORDER BY n.created_at DESC,n.id DESC LIMIT $4`,
    [actor, before ?? null, beforeId ?? null, limit],
  );
}
function pageLimit(limit: number) {
  return z.number().int().min(1).max(50).parse(limit);
}
function validateTimeCursor(before?: string, beforeId?: string) {
  if ((before === undefined) !== (beforeId === undefined))
    throw new BadRequestException("Use both cursor fields.");
  if (before !== undefined) z.iso.datetime({ offset: true }).parse(before);
  if (beforeId !== undefined) uuid.parse(beforeId);
}
function timePage(items: any[], limit: number) {
  const selected = items.slice(0, limit);
  const page = selected.map(({ cursor_created_at, ...item }) => item);
  const hasMore = items.length > limit;
  const last = selected.at(-1);
  return {
    items: page,
    hasMore,
    nextCursor:
      hasMore && last
        ? {
            before:
              last.cursor_created_at || new Date(last.created_at).toISOString(),
            beforeId: last.id,
          }
        : null,
  };
}
export async function matchesPage(
  actor: string,
  afterName?: string,
  afterId?: string,
  limit = 30,
) {
  pageLimit(limit);
  if ((afterName === undefined) !== (afterId === undefined))
    throw new BadRequestException("Use both cursor fields.");
  if (afterName !== undefined) z.string().max(80).parse(afterName);
  if (afterId !== undefined) uuid.parse(afterId);
  return readTx(async (db) => {
    const found = await matchRows(db, actor, afterName, afterId, limit + 1);
    const hasMore = found.length > limit;
    const page = found.slice(0, limit);
    const last = page.at(-1);
    return {
      items: await projectMatches(db, actor, page),
      hasMore,
      nextCursor:
        hasMore && last ? { afterName: last.name, afterId: last.id } : null,
    };
  });
}
export async function storiesPage(
  actor: string,
  before?: string,
  beforeId?: string,
  limit = 30,
) {
  pageLimit(limit);
  validateTimeCursor(before, beforeId);
  return readTx(async (db) => {
    const found = await storyRows(db, actor, limit + 1, before, beforeId);
    const page = timePage(found, limit);
    return { ...page, items: await projectStories(db, page.items) };
  });
}
export async function notificationsPage(
  actor: string,
  before?: string,
  beforeId?: string,
  limit = 30,
) {
  pageLimit(limit);
  validateTimeCursor(before, beforeId);
  return readTx(async (db) =>
    timePage(
      await notificationRows(db, actor, limit + 1, before, beforeId),
      limit,
    ),
  );
}
export async function state(actor: string) {
  return readTx(async (db) => {
    const me = await one(
      db,
      `SELECT ${publicFields},${privateProfileFields} FROM users WHERE id=$1`,
      [actor],
    );
    me.media = await rows(
      db,
      "SELECT p.media_id AS id,m.kind,p.position FROM profile_media p JOIN media m ON m.id=p.media_id WHERE p.user_id=$1 ORDER BY p.position,p.media_id",
      [actor],
    );
    if (!accountReady(me))
      return {
        me,
        matches: [],
        discover: [],
        undoId: null,
        feed: [],
        stories: [],
        notifications: [],
        games: gameCatalog,
        features: { gamesV2: gamesV2Enabled() },
      };
    const discover = await candidates(db, actor);
    const matches = await projectMatches(db, actor, await matchRows(db, actor));
    const stories = await projectStories(db, await storyRows(db, actor, 200));
    const notifications = (await notificationRows(db, actor, 50)).map(
      ({ cursor_created_at, ...n }) => n,
    );
    return {
      me,
      matches,
      discover,
      undoId: await lastUndo(db, actor),
      feed: await feed(db, actor),
      stories,
      notifications,
      games: gameCatalog,
      features: { gamesV2: gamesV2Enabled() },
    };
  });
}
export async function updateProfile(actor: string, body: unknown) {
  const p = profileInput.parse(body);
  await pool.query(
    "UPDATE users SET name=$2,city=$3,bio=$4,intent=$5,interests=$6,prompt=$7,gender=$8,preferences=$9,languages=$10,hobbies=$11,profession=$12,education=$13,lifestyle=$14 WHERE id=$1",
    [
      actor,
      p.name,
      p.city,
      p.bio,
      p.intent,
      p.interests,
      p.prompt,
      p.gender,
      JSON.stringify(p.preferences),
      p.languages,
      p.hobbies,
      p.profession,
      p.education,
      JSON.stringify(p.lifestyle),
    ],
  );
  return { ok: true };
}
export async function disconnect(
  actor: string,
  target: string,
  block: boolean,
) {
  return tx(async (db) => {
    if (actor === target) throw new BadRequestException();
    if (block)
      await db.query(
        "INSERT INTO blocks VALUES($1,$2) ON CONFLICT DO NOTHING",
        [actor, target],
      );
    await db.query(
      `UPDATE connections SET state='ended' WHERE a=LEAST($1::uuid,$2::uuid) AND b=GREATEST($1::uuid,$2::uuid)`,
      [actor, target],
    );
    await db.query(
      "DELETE FROM game_readiness WHERE (actor=$1 AND target=$2) OR (actor=$2 AND target=$1)",
      [actor, target],
    );
    await db.query(
      "UPDATE games SET state='cancelled' WHERE ((host=$1 AND guest=$2) OR (host=$2 AND guest=$1)) AND state IN ('invited','active')",
      [actor, target],
    );
    await db.query(
      "DELETE FROM follows WHERE (actor=$1 AND target=$2) OR (actor=$2 AND target=$1)",
      [actor, target],
    );
    await db.query(
      "DELETE FROM notifications WHERE (recipient=$1 AND actor=$2) OR (recipient=$2 AND actor=$1)",
      [actor, target],
    );
    return { ok: true };
  });
}
export async function createPost(actor: string, body: unknown) {
  const p = z
    .object({
      body: z.string().trim().max(2000),
      mediaId: uuid.nullish(),
      mediaIds: z.array(uuid).max(6).optional(),
      clientId: uuid.optional(),
    })
    .refine((v) => v.body || v.mediaId || v.mediaIds?.length)
    .refine((v) => !v.mediaId || !v.mediaIds, "Choose one media format.")
    .parse(body);
  const ids = p.mediaIds || (p.mediaId ? [p.mediaId] : []);
  if (new Set(ids).size !== ids.length)
    throw new BadRequestException("Choose each photo only once.");
  return tx(async (db) => {
    if (p.clientId) {
      const prior = await one(
        db,
        "SELECT id,body FROM posts WHERE author=$1 AND client_id=$2",
        [actor, p.clientId],
      );
      if (prior) {
        const attached = await rows(
          db,
          "SELECT media_id FROM post_media WHERE post_id=$1 ORDER BY position",
          [prior.id],
        );
        if (
          prior.body !== p.body ||
          JSON.stringify(attached.map((m) => m.media_id)) !==
            JSON.stringify(ids)
        )
          throw new BadRequestException(
            "That retry belongs to a different post.",
          );
        return { id: prior.id };
      }
    }
    for (const id of ids) {
      await ownMedia(db, actor, id);
      const media = await one(db, "SELECT kind FROM media WHERE id=$1", [id]);
      if (ids.length > 1 && media.kind !== "image")
        throw new BadRequestException("Choose up to six photos, or one video.");
    }
    const id = randomUUID();
    await db.query(
      "INSERT INTO posts(id,author,body,media_id,client_id) VALUES($1,$2,$3,$4,$5)",
      [id, actor, p.body, ids[0] || null, p.clientId || null],
    );
    for (const [position, mediaId] of ids.entries())
      await db.query(
        "INSERT INTO post_media(post_id,media_id,position) VALUES($1,$2,$3)",
        [id, mediaId, position],
      );
    return { id };
  });
}
export async function react(actor: string, id: string) {
  return tx(async (db) => {
    const post = await allowedPost(db, actor, id);
    if (
      post.author !== actor &&
      !(await one(
        db,
        "SELECT 1 FROM users WHERE id=$1 AND interactions_enabled",
        [post.author],
      ))
    )
      throw new ForbiddenException("Interactions are paused on this profile.");
    const r = await db.query(
      "DELETE FROM reactions WHERE actor=$1 AND post_id=$2",
      [actor, id],
    );
    if (!r.rowCount)
      await db.query("INSERT INTO reactions VALUES($1,$2)", [id, actor]);
    return { ok: true };
  });
}
export async function comment(
  actor: string,
  id: string,
  body: string,
  parentId?: string,
) {
  return tx(async (db) => {
    const p = await allowedPost(db, actor, id);
    if (
      p.author !== actor &&
      !(await one(
        db,
        "SELECT 1 FROM users WHERE id=$1 AND interactions_enabled",
        [p.author],
      ))
    )
      throw new ForbiddenException("Interactions are paused on this profile.");
    if (parentId) {
      const parent = await one(
        db,
        "SELECT author FROM comments WHERE id=$1 AND post_id=$2",
        [parentId, id],
      );
      if (!parent || !(await matched(db, actor, parent.author)))
        throw new NotFoundException("Reply unavailable.");
    }

    await db.query(
      "INSERT INTO comments(id,post_id,author,body,parent_id) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), id, actor, body, parentId || null],
    );
    if (p.author !== actor)
      await notify(
        db,
        p.author,
        actor,
        "comment",
        "A match replied to your moment.",
      );
    return { ok: true };
  });
}
export async function createStory(actor: string, body: unknown) {
  const p = z
    .object({ body: z.string().max(300), mediaId: uuid.nullish() })
    .refine((v) => v.body || v.mediaId)
    .parse(body);
  return tx(async (db) => {
    await ownMedia(db, actor, p.mediaId, "story");
    const id = randomUUID();
    await db.query(
      "INSERT INTO stories(id,author,body,media_id) VALUES($1,$2,$3,$4)",
      [id, actor, p.body, p.mediaId || null],
    );
    return { id };
  });
}
