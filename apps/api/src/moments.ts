import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { DB, matched, one, profile, requireMatch, rows, tx } from "./db";
import { allowedPost, notify } from "./social";

export async function projectPost(db: DB, actor: string, p: any) {
  const comments = await rows(
    db,
    "SELECT * FROM comments WHERE post_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50",
    [p.id],
  );
  const visible = [];
  for (const c of comments)
    if (await matched(db, actor, c.author))
      visible.push({ ...c, author: await profile(db, c.author) });
  const ids = new Set(visible.map((c) => c.id));
  const reactions = await rows(
    db,
    "SELECT actor FROM reactions WHERE post_id=$1",
    [p.id],
  );
  let likes = 0;
  for (const r of reactions) if (await matched(db, actor, r.actor)) likes++;
  return {
    ...p,
    author: await profile(db, p.author),
    comments: visible
      .filter((c) => !c.parent_id || ids.has(c.parent_id))
      .reverse(),
    likes,
    liked: reactions.some((r) => r.actor === actor),
    saved: !!(await one(
      db,
      "SELECT 1 FROM saved_posts WHERE actor=$1 AND post_id=$2",
      [actor, p.id],
    )),
  };
}
export async function postDetail(db: DB, actor: string, id: string) {
  await allowedPost(db, actor, id);
  const p = await one(
    db,
    "SELECT p.*,m.kind FROM posts p LEFT JOIN media m ON m.id=p.media_id WHERE p.id=$1",
    [id],
  );
  return projectPost(db, actor, p);
}
export async function save(actor: string, id: string, enabled: boolean) {
  return tx(async (db) => {
    await allowedPost(db, actor, id);
    if (enabled)
      await db.query(
        "INSERT INTO saved_posts(actor,post_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [actor, id],
      );
    else
      await db.query("DELETE FROM saved_posts WHERE actor=$1 AND post_id=$2", [
        actor,
        id,
      ]);
    return { ok: true };
  });
}
export async function saved(actor: string) {
  return tx(async (db) => {
    const ids = await rows(
      db,
      "SELECT post_id FROM saved_posts WHERE actor=$1 ORDER BY created_at DESC LIMIT 50",
      [actor],
    );
    const out = [];
    for (const p of ids) {
      try {
        out.push(await postDetail(db, actor, p.post_id));
      } catch (e) {
        if (!(e instanceof NotFoundException)) throw e;
      }
    }
    return out;
  });
}
export async function share(
  actor: string,
  id: string,
  target: string,
  clientId: string,
) {
  return tx(async (db) => {
    await requireMatch(db, actor, target);
    await allowedPost(db, actor, id);
    await allowedPost(db, target, id);
    if (
      !(await one(db, "SELECT 1 FROM users WHERE id=$1 AND messages_enabled", [
        target,
      ]))
    )
      throw new ForbiddenException("This match has paused new messages.");
    const prior = await one(
      db,
      "SELECT * FROM messages WHERE sender=$1 AND recipient=$2 AND client_id=$3",
      [actor, target, clientId],
    );
    if (prior) {
      if (prior.post_id !== id)
        throw new BadRequestException(
          "That retry belongs to a different message.",
        );
      return { id: prior.id };
    }
    const message = randomUUID();
    await db.query(
      "INSERT INTO messages(id,sender,recipient,client_id,body,post_id) VALUES($1,$2,$3,$4,'',$5)",
      [message, actor, target, clientId, id],
    );
    await notify(
      db,
      target,
      actor,
      "message",
      "A match shared a moment with you.",
    );
    return { id: message };
  });
}
