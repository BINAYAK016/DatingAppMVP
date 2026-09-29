import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { one, profile, requireMatch, rows, tx, DB } from "./db";
import { gameCatalog, text, uuid } from "./validation";
import { notify, ownMedia } from "./social";

import { projectGame, readiness } from "./games";
import { postDetail } from "./moments";
export async function conversation(
  actor: string,
  target: string,
  before?: string,
  beforeId?: string,
) {
  return tx(async (db) => {
    await requireMatch(db, actor, target);
    const items = await rows(
      db,
      `SELECT * FROM (
      SELECT id,created_at,'message' AS type FROM messages WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1)
      UNION ALL SELECT id,created_at,'snap' FROM snaps WHERE ((sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1)) AND expires_at>now()
      UNION ALL SELECT id,created_at,'game' FROM games WHERE (host=$1 AND guest=$2) OR (host=$2 AND guest=$1)
      UNION ALL SELECT id,created_at,'plan' FROM plans WHERE (host=$1 AND guest=$2) OR (host=$2 AND guest=$1)
    ) t WHERE ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,COALESCE($4::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))) ORDER BY created_at DESC,id DESC LIMIT 50`,
      [actor, target, before || null, beforeId || null],
    );
    const timeline = [];
    for (const item of items) {
      let value;
      if (item.type === "message") {
        value = await one(
          db,
          "SELECT m.*,media.kind FROM messages m LEFT JOIN media ON media.id=m.media_id WHERE m.id=$1",
          [item.id],
        );
        if (value.post_id) {
          try {
            value.sharedPost = await postDetail(db, actor, value.post_id);
          } catch (e) {
            if (!(e instanceof NotFoundException)) throw e;
            value.sharedPost = null;
          }
        }
      } else if (item.type === "snap")
        value = await one(
          db,
          "SELECT id,sender,recipient,caption,opened_at,expires_at,created_at FROM snaps WHERE id=$1",
          [item.id],
        );
      else if (item.type === "game")
        value = projectGame(
          await one(
            db,
            "SELECT *,expires_at<=now() AS expired FROM games WHERE id=$1",
            [item.id],
          ),
          actor,
        );
      else value = await one(db, "SELECT * FROM plans WHERE id=$1", [item.id]);
      timeline.push({ ...value, type: item.type });
    }
    await db.query(
      "UPDATE messages SET read_at=now() WHERE recipient=$1 AND sender=$2 AND read_at IS NULL AND id=ANY($3::uuid[])",
      [
        actor,
        target,
        items.filter((i) => i.type === "message").map((i) => i.id),
      ],
    );
    const gameRows = await rows(
      db,
      "SELECT *,expires_at<=now() AS expired FROM games WHERE (host=$1 AND guest=$2) OR (host=$2 AND guest=$1) ORDER BY created_at DESC LIMIT 20",
      [actor, target],
    );
    return {
      person: await profile(db, target),
      timeline: timeline.reverse(),
      hasMore: items.length === 50,
      games: gameRows.map((g) => projectGame(g, actor)),
      readiness: await readiness(db, actor, target),
    };
  });
}
export async function sendMessage(
  actor: string,
  target: string,
  body: unknown,
) {
  const p = z
    .object({
      body: z.string().trim().max(2000),
      mediaId: uuid.optional(),
      clientId: text(100),
    })
    .refine((p) => p.body || p.mediaId, "Write a message or choose media.")
    .parse(body);
  return tx(async (db) => {
    await requireMatch(db, actor, target);
    if (
      !(await one(db, "SELECT 1 FROM users WHERE id=$1 AND messages_enabled", [
        target,
      ]))
    )
      throw new ForbiddenException("This match has paused new messages.");
    await ownMedia(db, actor, p.mediaId, "chat:" + target);
    const r = await one(
      db,
      `INSERT INTO messages(id,sender,recipient,body,client_id,media_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(sender,recipient,client_id) DO NOTHING RETURNING *`,
      [randomUUID(), actor, target, p.body, p.clientId, p.mediaId || null],
    );
    if (r)
      await notify(db, target, actor, "message", "A match sent you a message.");
    return (
      r ||
      (await one(
        db,
        "SELECT * FROM messages WHERE sender=$1 AND recipient=$2 AND client_id=$3",
        [actor, target, p.clientId],
      ))
    );
  });
}
export async function sendSnap(actor: string, target: string, body: unknown) {
  const p = z
    .object({ mediaId: uuid, caption: z.string().max(140) })
    .parse(body);
  return tx(async (db) => {
    await requireMatch(db, actor, target);
    if (
      !(await one(db, "SELECT 1 FROM users WHERE id=$1 AND messages_enabled", [
        target,
      ]))
    )
      throw new ForbiddenException("This match has paused new messages.");
    await ownMedia(db, actor, p.mediaId, "snap:" + target);
    const id = randomUUID();
    await db.query(
      "INSERT INTO snaps(id,sender,recipient,media_id,caption) VALUES($1,$2,$3,$4,$5)",
      [id, actor, target, p.mediaId, p.caption],
    );
    await notify(db, target, actor, "snap", "A match sent you a snap.");
    return { id };
  });
}
export async function openSnap(actor: string, id: string) {
  return tx(async (db) => {
    const snap = await one(
      db,
      "SELECT * FROM snaps WHERE id=$1 AND recipient=$2 AND expires_at>now() FOR UPDATE",
      [id, actor],
    );
    if (!snap || snap.opened_at)
      throw new NotFoundException("This snap is no longer available.");
    await requireMatch(db, actor, snap.sender);
    const updated = await one(
      db,
      `UPDATE snaps SET opened_at=now(),view_until=now()+interval '30 seconds' WHERE id=$1 RETURNING view_until`,
      [id],
    );
    const m = await one(db, "SELECT kind FROM media WHERE id=$1", [
      snap.media_id,
    ]);
    return {
      mediaId: snap.media_id,
      kind: m.kind,
      viewUntil: updated.view_until,
      caption: snap.caption,
    };
  });
}
export async function closeSnap(actor: string, id: string) {
  await tx(async (db) => {
    await db.query(
      "UPDATE snaps SET view_until=now() WHERE id=$1 AND recipient=$2",
      [id, actor],
    );
  });
  return { ok: true };
}
export async function proposeDate(
  actor: string,
  target: string,
  body: unknown,
) {
  const p = z
    .object({
      title: text(100),
      venue: z.string().trim().max(150).default(""),
      scheduledAt: z.iso.datetime({ offset: true }),
    })
    .refine((p) => new Date(p.scheduledAt) > new Date(), {
      message: "Choose a future time.",
    })
    .parse(body);
  return tx(async (db) => {
    await requireMatch(db, actor, target);
    const id = randomUUID();
    await db.query(
      "INSERT INTO plans(id,host,guest,title,venue,scheduled_at) VALUES($1,$2,$3,$4,$5,$6)",
      [id, actor, target, p.title, p.venue, p.scheduledAt],
    );
    await notify(db, target, actor, "date", "A match suggested a date.");
    return { id };
  });
}
export async function answerDate(actor: string, id: string, status: string) {
  if (!["accepted", "declined", "cancelled"].includes(status))
    throw new BadRequestException();
  return tx(async (db) => {
    const p = await one(db, "SELECT * FROM plans WHERE id=$1 FOR UPDATE", [id]);
    if (!p || ![p.host, p.guest].includes(actor)) throw new NotFoundException();
    await requireMatch(db, p.host, p.guest);
    if (status !== "cancelled" && (actor !== p.guest || p.state !== "proposed"))
      throw new ForbiddenException();
    if (["declined", "cancelled"].includes(p.state))
      throw new BadRequestException("This plan is closed.");
    await db.query("UPDATE plans SET state=$2 WHERE id=$1", [id, status]);
    return { ok: true };
  });
}
