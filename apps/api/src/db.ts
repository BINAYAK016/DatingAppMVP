import { Pool, PoolClient } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

export type DB = Pool | PoolClient;
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://sangai:local-beta-only@localhost:15432/sangai",
  max: 10,
});
export async function rows(
  db: DB,
  text: string,
  values: unknown[] = [],
): Promise<any[]> {
  return (await db.query(text, values)).rows;
}
export async function one(
  db: DB,
  text: string,
  values: unknown[] = [],
): Promise<any> {
  return (await rows(db, text, values))[0];
}
export async function migrate() {
  await pool.query(readFileSync(join(__dirname, "../src/schema.sql"), "utf8"));
}
// All social mutations take one transaction-scoped lock in this local beta. This
// deliberately favors auditable privacy/race correctness over write throughput.
// Move to ordered per-pair/community locks before scaling, preserving these tests.
export async function tx<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(20260929)");
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function matched(db: DB, a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  return !!(await one(
    db,
    `SELECT 1 FROM connections c JOIN users u ON u.id=$1 JOIN users v ON v.id=$2
 WHERE c.a=LEAST($1::uuid,$2::uuid) AND c.b=GREATEST($1::uuid,$2::uuid) AND c.state='matched'
 AND NOT u.suspended AND NOT v.suspended AND NOT EXISTS (SELECT 1 FROM blocks WHERE (actor=$1 AND target=$2) OR (actor=$2 AND target=$1))`,
    [a, b],
  ));
}
export async function requireMatch(db: DB, a: string, b: string) {
  if (a === b || !(await matched(db, a, b)))
    throw new ForbiddenException("An active mutual match is required.");
}
export async function requireCircle(db: DB, actor: string, circleId: string) {
  const members = await rows(
    db,
    "SELECT user_id FROM circle_members WHERE circle_id=$1 ORDER BY user_id",
    [circleId],
  );
  if (!members.some((m) => m.user_id === actor))
    throw new NotFoundException("Community unavailable.");
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++)
      if (!(await matched(db, members[i].user_id, members[j].user_id)))
        throw new ForbiddenException(
          "Community paused: every member must be mutually matched.",
        );
  return members.map((m) => m.user_id as string);
}
export const publicFields = `id,name,EXTRACT(YEAR FROM age(birth_date))::int AS age,city,bio,intent,interests,prompt,gender,avatar_id,color,demo`;
export async function profile(db: DB, id: string) {
  return one(
    db,
    `SELECT ${publicFields} FROM users WHERE id=$1 AND NOT suspended`,
    [id],
  );
}
