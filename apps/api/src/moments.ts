import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  DB,
  matchVisibilitySql,
  one,
  publicFields,
  readTx,
  requireMatch,
  rows,
  tx,
} from "./db";
import { allowedPost, notify } from "./social";

export async function projectPosts(db: DB, actor: string, posts: any[]) {
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  // Filter visibility before each post's limit; unrelated authors must not crowd
  // authorized comments out of the preview. No per-comment authorization query.
  const comments = await rows(
    db,
    `SELECT visible_comment.* FROM unnest($2::uuid[]) AS wanted(post_id)
    CROSS JOIN LATERAL (
      SELECT c.* FROM comments c WHERE c.post_id=wanted.post_id
        AND ${matchVisibilitySql("$1::uuid", "c.author")}
      ORDER BY c.created_at DESC,c.id DESC LIMIT 50
    ) visible_comment
    ORDER BY visible_comment.post_id,visible_comment.created_at DESC,visible_comment.id DESC`,
    [actor, ids],
  );
  const reactions = await rows(
    db,
    `SELECT r.post_id,count(*)::int AS likes,bool_or(r.actor=$1::uuid) AS liked
    FROM reactions r WHERE r.post_id=ANY($2::uuid[])
      AND ${matchVisibilitySql("$1::uuid", "r.actor")}
    GROUP BY r.post_id`,
    [actor, ids],
  );
  const media = await rows(
    db,
    "SELECT pm.post_id,pm.media_id AS id,m.kind,pm.position FROM post_media pm JOIN media m ON m.id=pm.media_id WHERE pm.post_id=ANY($1::uuid[]) ORDER BY pm.post_id,pm.position",
    [ids],
  );
  const saved = await rows(
    db,
    "SELECT post_id FROM saved_posts WHERE actor=$1 AND post_id=ANY($2::uuid[])",
    [actor, ids],
  );
  const people = await rows(
    db,
    `SELECT ${publicFields} FROM users WHERE id=ANY($1::uuid[]) AND NOT suspended`,
    [
      Array.from(
        new Set([
          ...posts.map((p) => p.author),
          ...comments.map((c) => c.author),
        ]),
      ),
    ],
  );
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const reactionsByPost = new Map(reactions.map((r) => [r.post_id, r]));
  const savedIds = new Set(saved.map((p) => p.post_id));
  const commentsByPost = new Map<string, any[]>();
  const mediaByPost = new Map<string, any[]>();
  for (const c of comments) {
    const list = commentsByPost.get(c.post_id) || [];
    list.push(c);
    commentsByPost.set(c.post_id, list);
  }
  for (const { post_id, ...attachment } of media) {
    const list = mediaByPost.get(post_id) || [];
    list.push(attachment);
    mediaByPost.set(post_id, list);
  }
  return posts.map((p) => {
    const preview = commentsByPost.get(p.id) || [];
    const byId = new Map(preview.map((c) => [c.id, c]));
    const visibility = new Map<string, boolean>();
    const hasVisibleParent = (
      id: string,
      path = new Set<string>(),
    ): boolean => {
      if (visibility.has(id)) return visibility.get(id)!;
      const c = byId.get(id);
      if (!c || path.has(id)) return false;
      path.add(id);
      const visible = !c.parent_id || hasVisibleParent(c.parent_id, path);
      visibility.set(id, visible);
      return visible;
    };
    return {
      ...p,
      media: mediaByPost.get(p.id) || [],
      author: peopleById.get(p.author),
      comments: preview
        .filter((c) => hasVisibleParent(c.id))
        .reverse()
        .map((c) => ({ ...c, author: peopleById.get(c.author) })),
      likes: reactionsByPost.get(p.id)?.likes || 0,
      liked: reactionsByPost.get(p.id)?.liked || false,
      saved: savedIds.has(p.id),
    };
  });
}
export async function projectPost(db: DB, actor: string, p: any) {
  return (await projectPosts(db, actor, [p]))[0];
}
export async function postDetail(db: DB, actor: string, id: string) {
  await allowedPost(db, actor, id);
  const p = await one(
    db,
    `SELECT p.*,m.kind,to_char(p.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at FROM posts p LEFT JOIN media m ON m.id=p.media_id WHERE p.id=$1`,
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
  return readTx(async (db) => {
    const posts = await rows(
      db,
      `SELECT p.*,m.kind,to_char(p.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at FROM saved_posts saved
      JOIN posts p ON p.id=saved.post_id JOIN users u ON u.id=p.author
      LEFT JOIN media m ON m.id=p.media_id
      WHERE saved.actor=$1 AND (p.author=$1 OR u.posts_visible)
        AND ${matchVisibilitySql("$1::uuid", "p.author")}
      ORDER BY saved.created_at DESC,saved.post_id DESC LIMIT 50`,
      [actor],
    );
    return projectPosts(db, actor, posts);
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
