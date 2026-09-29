import { Pool, PoolClient } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
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
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(20260930)");
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const root = join(__dirname, "../src");
    const files = [
      "schema.sql",
      ...readdirSync(join(root, "migrations"))
        .filter((f) => /^\d+_.+\.sql$/.test(f))
        .sort()
        .map((f) => "migrations/" + f),
    ];
    for (const name of files) {
      const sql = readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const applied = await one(
        db,
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (applied && applied.checksum !== checksum)
        throw new Error(`Migration checksum mismatch: ${name}`);
      if (applied) continue;
      await db.query(sql);
      await db.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
    }
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
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
 AND NOT u.suspended AND NOT v.suspended AND u.demo=v.demo AND (u.demo OR (u.email_verified_at IS NOT NULL AND u.onboarded_at IS NOT NULL)) AND (v.demo OR (v.email_verified_at IS NOT NULL AND v.onboarded_at IS NOT NULL)) AND NOT EXISTS (SELECT 1 FROM blocks WHERE (actor=$1 AND target=$2) OR (actor=$2 AND target=$1))`,
    [a, b],
  ));
}
export async function requireMatch(db: DB, a: string, b: string) {
  if (a === b || !(await matched(db, a, b)))
    throw new ForbiddenException("An active mutual match is required.");
}
export const publicFields = `id,name,EXTRACT(YEAR FROM age(birth_date))::int AS age,city,bio,intent,interests,prompt,gender,avatar_id,color,demo,languages,hobbies,profession,education,lifestyle`;
export async function profile(db: DB, id: string) {
  return one(
    db,
    `SELECT ${publicFields} FROM users WHERE id=$1 AND NOT suspended`,
    [id],
  );
}
