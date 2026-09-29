import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { DB, one, requireMatch, rows, tx } from "./db";
import { gameCatalog, text } from "./validation";
import { notify } from "./social";

export async function readiness(db: DB, actor: string, target: string) {
  await requireMatch(db, actor, target);
  const ready = await rows(
    db,
    "SELECT actor FROM game_readiness WHERE ((actor=$1 AND target=$2) OR (actor=$2 AND target=$1)) AND expires_at>now()",
    [actor, target],
  );
  return {
    self: ready.some((r) => r.actor === actor),
    partner: ready.some((r) => r.actor === target),
  };
}
export async function setReady(
  actor: string,
  target: string,
  enabled: boolean,
) {
  return tx(async (db) => {
    await requireMatch(db, actor, target);
    if (enabled)
      await db.query(
        "INSERT INTO game_readiness(actor,target,expires_at) VALUES($1,$2,now()+interval '45 seconds') ON CONFLICT(actor) DO UPDATE SET target=$2,expires_at=now()+interval '45 seconds'",
        [actor, target],
      );
    else
      await db.query(
        "DELETE FROM game_readiness WHERE actor=$1 AND target=$2",
        [actor, target],
      );
    return readiness(db, actor, target);
  });
}
async function requireReady(db: DB, a: string, b: string) {
  const ready = await readiness(db, a, b);
  if (!ready.self || !ready.partner)
    throw new ConflictException(
      "Both of you need to be Ready to play with each other. Reconnect to continue.",
    );
}
export function projectGame(g: any, actor: string) {
  const state =
    ["active", "invited"].includes(g.state) && g.expired ? "expired" : g.state;
  const complete = state === "complete";
  const answered = !!g.answers[actor];
  const both = !!g.answers[g.host] && !!g.answers[g.guest];
  let answers: Record<string, unknown> = complete
    ? g.answers
    : answered
      ? { [actor]: g.answers[actor] }
      : {};
  if (g.kind === "two-truths" && !complete && both)
    answers = Object.fromEntries(
      [g.host, g.guest].map((id) => [
        id,
        id === actor ? g.answers[id] : { statements: g.answers[id].statements },
      ]),
    );
  return {
    ...g,
    state,
    answers,
    guesses: complete
      ? g.guesses
      : g.guesses[actor] === undefined
        ? {}
        : { [actor]: g.guesses[actor] },
    answered,
    bothAnswered: both,
    complete,
  };
}
async function load(db: DB, actor: string, id: string) {
  const g = await one(
    db,
    "SELECT *,expires_at<=now() AS expired FROM games WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (!g || ![g.host, g.guest].includes(actor))
    throw new NotFoundException("Game unavailable.");
  await requireMatch(db, g.host, g.guest);
  return g;
}
export async function invite(actor: string, target: string, kind: string) {
  if (!gameCatalog.some((g) => g.id === kind))
    throw new BadRequestException("Unknown game.");
  return tx(async (db) => {
    await requireReady(db, actor, target);
    const prior = await one(
      db,
      "SELECT id FROM games WHERE LEAST(host,guest)=LEAST($1::uuid,$2::uuid) AND GREATEST(host,guest)=GREATEST($1::uuid,$2::uuid) AND state IN ('invited','active') AND expires_at>now()",
      [actor, target],
    );
    if (prior)
      throw new ConflictException(
        "Finish or cancel your current invitation first.",
      );
    const id = randomUUID();
    await db.query(
      "INSERT INTO games(id,host,guest,kind) VALUES($1,$2,$3,$4)",
      [id, actor, target, kind],
    );
    await notify(db, target, actor, "game", "A match invited you to a game.");
    return { id };
  });
}
export async function respond(actor: string, id: string, response: string) {
  if (!["accept", "decline", "cancel"].includes(response))
    throw new BadRequestException();
  return tx(async (db) => {
    const g = await load(db, actor, id);
    const state = projectGame(g, actor).state;
    if (!["invited", "active"].includes(state))
      throw new ConflictException("This game is closed.");
    if (response !== "cancel" && (actor !== g.guest || state !== "invited"))
      throw new ForbiddenException(
        "Only the invited match can accept or decline.",
      );
    if (response === "accept") await requireReady(db, g.host, g.guest);
    const next =
      response === "accept"
        ? "active"
        : response === "decline"
          ? "declined"
          : "cancelled";
    await db.query(
      "UPDATE games SET state=$2,expires_at=CASE WHEN $2='active' THEN now()+interval '10 minutes' ELSE expires_at END WHERE id=$1",
      [id, next],
    );
    return { state: next };
  });
}
// Rulesets validate their own payloads. Standard games have no entitlement gate.
const choice = z.array(z.number().int().min(0).max(1)).length(5);
const rules: Record<string, z.ZodType> = {
  "this-or-that": choice,
  "would-you-rather": choice,
  "two-truths": z.object({
    statements: z
      .array(text(180))
      .length(3)
      .refine(
        (s) => new Set(s.map((v) => v.toLowerCase())).size === 3,
        "Use three different statements.",
      ),
    lie: z.number().int().min(0).max(2),
  }),
};
export async function answer(actor: string, id: string, body: unknown) {
  return tx(async (db) => {
    const g = await load(db, actor, id);
    if (projectGame(g, actor).state !== "active")
      throw new BadRequestException(
        "Accept an active invitation before playing.",
      );
    await requireReady(db, g.host, g.guest);
    if (g.answers[actor])
      throw new BadRequestException("Your answers are already locked in.");
    const rule = rules[g.kind];
    if (!rule)
      throw new BadRequestException("This game belongs to an older version.");
    g.answers[actor] = rule.parse(body);
    if (g.kind !== "two-truths" && g.answers[g.host] && g.answers[g.guest])
      g.state = "complete";
    await db.query("UPDATE games SET answers=$2,state=$3 WHERE id=$1", [
      id,
      JSON.stringify(g.answers),
      g.state,
    ]);
    return projectGame(g, actor);
  });
}
export async function guess(actor: string, id: string, value: unknown) {
  const n = z.number().int().min(0).max(2).parse(value);
  return tx(async (db) => {
    const g = await load(db, actor, id);
    if (
      g.kind !== "two-truths" ||
      projectGame(g, actor).state !== "active" ||
      !g.answers[g.host] ||
      !g.answers[g.guest]
    )
      throw new BadRequestException(
        "Both players must lock in their statements first.",
      );
    await requireReady(db, g.host, g.guest);
    if (g.guesses[actor] !== undefined)
      throw new BadRequestException("Your guess is already locked in.");
    g.guesses[actor] = n;
    if (g.guesses[g.host] !== undefined && g.guesses[g.guest] !== undefined)
      g.state = "complete";
    await db.query("UPDATE games SET guesses=$2,state=$3 WHERE id=$1", [
      id,
      JSON.stringify(g.guesses),
      g.state,
    ]);
    return projectGame(g, actor);
  });
}
