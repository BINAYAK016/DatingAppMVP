import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { DB, matched, one, profile, publicFields, rows, tx } from "./db";
import { uuid } from "./validation";

// Both people's explicit preferences apply. Incoming Likes never affect ordering
// or the profile projection, so discovery cannot act as an incoming-Likes inbox.
export const eligibility = `NOT u.paused AND NOT u.suspended AND NOT me.paused AND NOT me.suspended
 AND u.demo=me.demo
 AND (u.demo OR (u.email_verified_at IS NOT NULL AND u.onboarded_at IS NOT NULL))
 AND (me.demo OR (me.email_verified_at IS NOT NULL AND me.onboarded_at IS NOT NULL))
 AND (COALESCE(me.preferences->'intents','[]'::jsonb)='[]'::jsonb OR me.preferences->'intents' ? u.intent)
 AND (COALESCE(u.preferences->'intents','[]'::jsonb)='[]'::jsonb OR u.preferences->'intents' ? me.intent)
 AND EXTRACT(YEAR FROM age(u.birth_date)) BETWEEN (me.preferences->>'minAge')::int AND (me.preferences->>'maxAge')::int
 AND EXTRACT(YEAR FROM age(me.birth_date)) BETWEEN (u.preferences->>'minAge')::int AND (u.preferences->>'maxAge')::int
 AND (me.preferences->'cities'='[]'::jsonb OR me.preferences->'cities' ? u.city)
 AND (u.preferences->'cities'='[]'::jsonb OR u.preferences->'cities' ? me.city)
 AND (me.preferences->'genders'='[]'::jsonb OR me.preferences->'genders' ? u.gender)
 AND (u.preferences->'genders'='[]'::jsonb OR u.preferences->'genders' ? me.gender)
 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.actor=me.id AND b.target=u.id) OR (b.actor=u.id AND b.target=me.id))
 AND NOT EXISTS(SELECT 1 FROM connections c WHERE c.a=LEAST(me.id,u.id) AND c.b=GREATEST(me.id,u.id) AND c.state IN ('matched','declined','ended'))`;
export async function candidates(db: DB, actor: string) {
  return rows(
    db,
    `SELECT ${publicFields} FROM users WHERE id IN (
    SELECT u.id FROM users u CROSS JOIN users me WHERE me.id=$1 AND u.id<>me.id AND ${eligibility}
    AND NOT EXISTS(SELECT 1 FROM discovery_actions d WHERE d.actor=me.id AND d.target=u.id AND d.undone_at IS NULL)
  ) ORDER BY created_at,id LIMIT 30`,
    [actor],
  );
}
export async function lastUndo(db: DB, actor: string) {
  const action = await one(
    db,
    "SELECT id,target FROM discovery_actions WHERE actor=$1 AND undone_at IS NULL ORDER BY ordinal DESC LIMIT 1",
    [actor],
  );
  if (!action) return null;
  const closed = await one(
    db,
    "SELECT 1 FROM connections WHERE a=LEAST($1::uuid,$2::uuid) AND b=GREATEST($1::uuid,$2::uuid) AND state<>'pending'",
    [actor, action.target],
  );
  return closed ? null : action.id;
}
export async function swipe(actor: string, target: string, body: unknown) {
  const input = z
    .object({ action: z.enum(["like", "pass", "super"]), clientId: uuid })
    .parse(body);
  return tx(async (db) => {
    const prior = await one(db, "SELECT * FROM discovery_actions WHERE id=$1", [
      input.clientId,
    ]);
    if (prior) {
      if (
        prior.actor !== actor ||
        prior.target !== target ||
        prior.kind !== input.action ||
        prior.undone_at
      )
        throw new ConflictException(
          "This action has already changed. Refresh discovery.",
        );
      return { id: prior.id, matched: await matched(db, actor, target) };
    }
    const valid = await one(
      db,
      `SELECT 1 FROM users u CROSS JOIN users me WHERE u.id=$2 AND me.id=$1 AND u.id<>me.id AND ${eligibility}`,
      [actor, target],
    );
    if (!valid)
      throw new NotFoundException(
        "Profile unavailable for your current preferences.",
      );
    if (
      await one(
        db,
        "SELECT 1 FROM discovery_actions WHERE actor=$1 AND target=$2 AND undone_at IS NULL",
        [actor, target],
      )
    )
      throw new ConflictException("You have already decided on this profile.");
    await db.query(
      "INSERT INTO discovery_actions(id,actor,target,kind) VALUES($1,$2,$3,$4)",
      [input.clientId, actor, target, input.action],
    );
    const mutual =
      input.action !== "pass" &&
      !!(await one(
        db,
        "SELECT 1 FROM discovery_actions WHERE actor=$2 AND target=$1 AND kind IN ('like','super') AND undone_at IS NULL",
        [actor, target],
      ));
    if (mutual) {
      await db.query(
        `INSERT INTO connections(a,b,sender,state) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1,'matched')
        ON CONFLICT(a,b) DO UPDATE SET state='matched',note='' WHERE connections.state='pending'`,
        [actor, target],
      );
      for (const [recipient, sender] of [
        [actor, target],
        [target, actor],
      ]) {
        await db.query(
          "INSERT INTO notifications(id,recipient,actor,kind,body) VALUES($1,$2,$3,'match','You have a new mutual match.')",
          [randomUUID(), recipient, sender],
        );
      }
    }
    return { id: input.clientId, matched: mutual };
  });
}
export async function undo(actor: string, id: string) {
  return tx(async (db) => {
    if ((await lastUndo(db, actor)) !== id)
      throw new BadRequestException(
        "Only your latest decision before a mutual match can be undone.",
      );
    const action = await one(
      db,
      "SELECT target FROM discovery_actions WHERE id=$1 AND actor=$2",
      [id, actor],
    );
    if (
      await one(
        db,
        "SELECT 1 FROM blocks WHERE (actor=$1 AND target=$2) OR (actor=$2 AND target=$1)",
        [actor, action.target],
      )
    )
      throw new NotFoundException("Profile unavailable.");
    await db.query("UPDATE discovery_actions SET undone_at=now() WHERE id=$1", [
      id,
    ]);
    await db.query(
      "DELETE FROM connections WHERE sender=$1 AND (a=$2 OR b=$2) AND state='pending'",
      [actor, action.target],
    );
    return { ok: true };
  });
}
export async function visibleProfile(actor: string, target: string) {
  return tx(async (db) => {
    const visible =
      actor === target ||
      (await matched(db, actor, target)) ||
      (await one(
        db,
        `SELECT 1 FROM users u CROSS JOIN users me WHERE me.id=$1 AND u.id=$2 AND ${eligibility}`,
        [actor, target],
      ));
    if (!visible) throw new NotFoundException("Profile unavailable.");
    return {
      ...(await profile(db, target)),
      media: await rows(
        db,
        "SELECT p.media_id AS id,m.kind,p.position FROM profile_media p JOIN media m ON m.id=p.media_id WHERE p.user_id=$1 ORDER BY p.position,p.media_id",
        [target],
      ),
    };
  });
}
