import { test } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("upgrade preserves legacy pairs and circle data, migrates one-sided consent once, and rejects checksum drift", async () => {
  const base =
    process.env.TEST_DATABASE_URL ||
    "postgres://sangai:local-beta-only@localhost:15432/sangai";
  const admin = new Pool({ connectionString: base });
  const name = "sangai_migration_" + randomUUID().replaceAll("-", "");
  const url = new URL(base);
  url.pathname = "/" + name;
  const db = new Pool({ connectionString: url.toString() });
  await admin.query(`CREATE DATABASE ${name}`);
  try {
    await db.query(readFileSync("src/schema.sql", "utf8"));
    const ids = [randomUUID(), randomUUID(), randomUUID()].sort();
    for (const id of ids)
      await db.query(
        "INSERT INTO users(id,email,password_hash,name,birth_date,city) VALUES($1,$2,'fixture','Legacy','1995-01-01','Kathmandu')",
        [id, id + "@example.test"],
      );
    await db.query(
      "INSERT INTO connections(a,b,sender,state) VALUES($1,$2,$1,'pending'),($1,$3,$1,'matched')",
      ids,
    );
    const circle = randomUUID();
    await db.query(
      "INSERT INTO circles(id,owner,name,description) VALUES($1,$2,'Restricted legacy','Do not redistribute')",
      [circle, ids[0]],
    );
    await db.query(
      "INSERT INTO notifications(id,recipient,actor,kind,body) VALUES($1,$2,$3,'request','Legacy sender')",
      [randomUUID(), ids[1], ids[0]],
    );
    const media = randomUUID(),
      post = randomUUID();
    await db.query(
      "INSERT INTO media(id,owner,kind,path,mime) VALUES($1,$2,'image','fixture','image/jpeg')",
      [media, ids[0]],
    );
    await db.query(
      "INSERT INTO posts(id,author,body,media_id) VALUES($1,$2,'Legacy photo',$3)",
      [post, ids[0], media],
    );
    const migrate = () =>
      spawnSync(
        process.execPath,
        [
          "-e",
          "const d=require('./dist/db');d.migrate().then(()=>d.pool.end()).catch(()=>{d.pool.end().then(()=>process.exit(1));})",
        ],
        {
          env: { ...process.env, DATABASE_URL: url.toString() },
          encoding: "utf8",
        },
      );
    assert.equal(migrate().status, 0);
    assert.equal(migrate().status, 0);
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM discovery_actions"))
        .rows[0].n,
      1,
    );
    const action = (
      await db.query("SELECT actor,target,kind FROM discovery_actions")
    ).rows[0];
    assert.deepEqual(action, { actor: ids[0], target: ids[1], kind: "like" });
    assert.equal(
      (await db.query("SELECT state FROM connections WHERE b=$1", [ids[2]]))
        .rows[0].state,
      "matched",
    );
    assert.equal(
      (
        await db.query("SELECT count(*)::int AS n FROM circles WHERE id=$1", [
          circle,
        ])
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM notifications WHERE kind='request'",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM schema_migrations"))
        .rows[0].n,
      7,
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT media_id,position FROM post_media WHERE post_id=$1",
          [post],
        )
      ).rows,
      [{ media_id: media, position: 0 }],
    );
    await db.query(
      "UPDATE schema_migrations SET checksum='tampered' WHERE name='schema.sql'",
    );
    assert.equal(migrate().status, 1);
  } finally {
    await db.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
