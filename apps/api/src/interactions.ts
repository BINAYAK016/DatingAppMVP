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

export function projectGame(g: any, actor: string) {
  const answered = !!g.answers[actor];
  const complete = !!g.answers[g.host] && !!g.answers[g.guest];
  return {
    ...g,
    answers: complete
      ? g.answers
      : answered
        ? { [actor]: g.answers[actor] }
        : {},
    answered,
    complete,
  };
}
export async function conversation(actor: string, target: string) {
  return tx(async (db) => {
    await requireMatch(db, actor, target);
    const messages = await rows(
      db,
      `SELECT * FROM (SELECT * FROM messages WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1) ORDER BY created_at DESC,id DESC LIMIT 100) t ORDER BY created_at,id`,
      [actor, target],
    );
    const snaps = await rows(
      db,
      `SELECT id,sender,recipient,caption,opened_at,expires_at,created_at FROM snaps WHERE ((sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1)) AND expires_at>now() ORDER BY created_at DESC`,
      [actor, target],
    );
    const games = await rows(
      db,
      `SELECT * FROM games WHERE (host=$1 AND guest=$2) OR (host=$2 AND guest=$1) ORDER BY created_at DESC LIMIT 20`,
      [actor, target],
    );
    const plans = await rows(
      db,
      `SELECT * FROM plans WHERE (host=$1 AND guest=$2) OR (host=$2 AND guest=$1) ORDER BY created_at DESC LIMIT 20`,
      [actor, target],
    );
    return {
      person: await profile(db, target),
      messages,
      snaps,
      games: games.map((g) => projectGame(g, actor)),
      plans,
    };
  });
}
export async function sendMessage(
  actor: string,
  target: string,
  body: unknown,
) {
  const p = z.object({ body: text(2000), clientId: text(100) }).parse(body);
  return tx(async (db) => {
    await requireMatch(db, actor, target);
    const r = await one(
      db,
      `INSERT INTO messages(id,sender,recipient,body,client_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(sender,recipient,client_id) DO NOTHING RETURNING *`,
      [randomUUID(), actor, target, p.body, p.clientId],
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
    await ownMedia(db, actor, p.mediaId);
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
export async function startGame(actor: string, target: string, kind: string) {
  if (!gameCatalog.some((g) => g.id === kind))
    throw new BadRequestException("Unknown game.");
  return tx(async (db) => {
    await requireMatch(db, actor, target);
    const id = randomUUID();
    await db.query(
      "INSERT INTO games(id,host,guest,kind) VALUES($1,$2,$3,$4)",
      [id, actor, target, kind],
    );
    await notify(db, target, actor, "game", "A match invited you to a game.");
    return { id };
  });
}
export async function gameAnswer(actor: string, id: string, answers: unknown) {
  const values = z
    .array(z.number().int().min(0).max(1))
    .length(5)
    .parse(answers);
  return tx(async (db) => {
    const g = await one(db, "SELECT * FROM games WHERE id=$1 FOR UPDATE", [id]);
    if (!g || ![g.host, g.guest].includes(actor)) throw new NotFoundException();
    await requireMatch(db, g.host, g.guest);
    if (g.answers[actor])
      throw new BadRequestException("Your answers are already locked in.");
    g.answers[actor] = values;
    await db.query("UPDATE games SET answers=$2 WHERE id=$1", [
      id,
      JSON.stringify(g.answers),
    ]);
    await notify(
      db,
      actor === g.host ? g.guest : g.host,
      actor,
      "game",
      "Your match played their turn.",
    );
    return projectGame(g, actor);
  });
}
export async function proposeDate(
  actor: string,
  target: string,
  body: unknown,
) {
  const p = z
    .object({
      title: text(100),
      venue: text(150),
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
