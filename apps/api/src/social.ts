import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  DB,
  matched,
  one,
  pool,
  profile,
  publicFields,
  requireMatch,
  rows,
  tx,
} from "./db";
import { gameCatalog, profileInput, text, uuid } from "./validation";
import { z } from "zod";
import { projectPost } from "./moments";
import { candidates, lastUndo } from "./discovery";
import { accountReady, privateProfileFields } from "./identity";

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
    `SELECT p.*,m.kind FROM posts p LEFT JOIN media m ON m.id=p.media_id JOIN users u ON u.id=p.author WHERE (NOT $4::boolean OR p.author=$1) AND NOT u.suspended AND (p.author=$1 OR u.posts_visible) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.actor=$1 AND b.target=p.author) OR (b.actor=p.author AND b.target=$1)) AND ($2::timestamptz IS NULL OR (p.created_at,p.id)<($2::timestamptz,COALESCE($3::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))) AND (p.author=$1 OR EXISTS (SELECT 1 FROM connections c WHERE c.a=LEAST($1::uuid,p.author) AND c.b=GREATEST($1::uuid,p.author) AND c.state='matched')) ORDER BY p.created_at DESC,p.id DESC LIMIT 30`,
    [actor, before || null, beforeId || null, ownOnly],
  );
  const out = [];
  for (const p of candidates)
    if (await matched(db, actor, p.author))
      out.push(await projectPost(db, actor, p));
  return out;
}
export async function state(actor: string) {
  return tx(async (db) => {
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
      };
    const discover = await candidates(db, actor);
    const matches = await rows(
      db,
      `SELECT ${publicFields} FROM users u WHERE u.id<>$1 AND NOT u.suspended AND u.demo=$2 AND (u.demo OR (u.email_verified_at IS NOT NULL AND u.onboarded_at IS NOT NULL))
      AND EXISTS(SELECT 1 FROM connections c WHERE c.a=LEAST($1::uuid,u.id) AND c.b=GREATEST($1::uuid,u.id) AND c.state='matched')
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.actor=$1 AND b.target=u.id) OR (b.actor=u.id AND b.target=$1)) ORDER BY u.name,u.id`,
      [actor, me.demo],
    );
    const storyRows = await rows(
      db,
      `SELECT s.*,m.kind FROM stories s LEFT JOIN media m ON m.id=s.media_id JOIN users u ON u.id=s.author WHERE s.expires_at>now() AND (s.author=$1 OR u.stories_visible) ORDER BY s.created_at DESC LIMIT 200`,
      [actor],
    );
    const stories = [];
    for (const s of storyRows)
      if (await matched(db, actor, s.author))
        stories.push({ ...s, author: await profile(db, s.author) });
    const notifications = await rows(
      db,
      `SELECT n.* FROM notifications n JOIN users source ON source.id=n.actor WHERE n.recipient=$1 AND n.kind<>'request' AND NOT source.suspended AND EXISTS(SELECT 1 FROM connections c WHERE c.a=LEAST(n.recipient,n.actor) AND c.b=GREATEST(n.recipient,n.actor) AND c.state='matched') AND NOT EXISTS(SELECT 1 FROM blocks WHERE (actor=$1 AND target=n.actor) OR (actor=n.actor AND target=$1)) ORDER BY n.created_at DESC LIMIT 50`,
      [actor],
    );
    return {
      me,
      matches: await Promise.all(
        matches.map(async (p) => ({
          ...p,
          unread: Number(
            (
              await one(
                db,
                "SELECT count(*) AS n FROM messages WHERE sender=$1 AND recipient=$2 AND read_at IS NULL",
                [p.id, actor],
              )
            ).n,
          ),
          preview:
            (
              await one(
                db,
                "SELECT CASE WHEN media_id IS NOT NULL THEN 'Photo or video' WHEN post_id IS NOT NULL THEN 'Shared moment' ELSE body END AS body FROM messages WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1) ORDER BY created_at DESC,id DESC LIMIT 1",
                [actor, p.id],
              )
            )?.body || "You chose each other. Say hello.",
        })),
      ),
      discover,
      undoId: await lastUndo(db, actor),
      feed: await feed(db, actor),
      stories,
      notifications,
      games: gameCatalog,
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
    .object({ body: z.string().trim().max(2000), mediaId: uuid.nullish() })
    .refine((v) => v.body || v.mediaId)
    .parse(body);
  return tx(async (db) => {
    await ownMedia(db, actor, p.mediaId);
    const id = randomUUID();
    await db.query(
      "INSERT INTO posts(id,author,body,media_id) VALUES($1,$2,$3,$4)",
      [id, actor, p.body, p.mediaId || null],
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
