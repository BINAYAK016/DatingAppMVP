import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import sharp from "sharp";
import { dropIsolatedDatabase } from "./database-cleanup";

const base =
  process.env.TEST_DATABASE_URL ||
  "postgres://sangai:local-beta-only@localhost:15432/sangai";
const admin = new Pool({ connectionString: base });
const database = "sangai_security_" + randomUUID().replaceAll("-", "");
const connection = new URL(base);
connection.pathname = "/" + database;
const directory = join(tmpdir(), "sangai-security-" + randomUUID());
let db: typeof import("../src/db");
let media: typeof import("../src/media");
let limits: typeof import("../src/rate-limit");
let social: typeof import("../src/social");
let app: any;
let api: string;
let token: string;
const actor = randomUUID(),
  partner = randomUUID();
before(async () => {
  await admin.query(`CREATE DATABASE ${database}`);
  await mkdir(directory);
  process.env.DATABASE_URL = connection.toString();
  process.env.UPLOAD_DIR = directory;
  process.env.ENABLE_DEMO = "false";
  process.env.ENABLE_PUSH = "false";
  process.env.OTP_HASH_SECRET = randomBytes(32).toString("hex");
  process.env.ADMIN_KEY = "synthetic-security-admin-key";
  process.env.PORT = "0";
  process.env.NODE_ENV = "test";
  db = require(resolve("dist/db.js"));
  media = require(resolve("dist/media.js"));
  limits = require(resolve("dist/rate-limit.js"));
  social = require(resolve("dist/social.js"));
  await db.migrate();
  for (const id of [actor, partner])
    await db.pool.query(
      "INSERT INTO users(id,email,password_hash,name,birth_date,city,email_verified_at,adult_declared_at,onboarded_at,onboarding_step) VALUES($1,$2,'synthetic','Synthetic Security','1995-01-01','Kathmandu',now(),now(),now(),5)",
      [id, id + "@example.test"],
    );
  token = (await require(resolve("dist/auth.js")).session(db.pool, actor))
    .token;
  app = await require(resolve("dist/main.js")).bootstrap();
  api = `http://127.0.0.1:${app.getHttpServer().address().port}`;
});
after(async () => {
  await app?.close();
  if (db) await db.pool.end();
  await dropIsolatedDatabase(admin, database);
  await admin.end();
  await rm(directory, { recursive: true, force: true });
});
async function fixtureImage(old = false) {
  const id = randomUUID(),
    path = join(directory, id + ".jpg");
  await writeFile(
    path,
    await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#aa536b" },
    })
      .jpeg()
      .toBuffer(),
  );
  await db.pool.query(
    "INSERT INTO media(id,owner,kind,path,mime,created_at) VALUES($1,$2,'image',$3,'image/jpeg',now()-$4*interval '1 hour')",
    [id, actor, path, old ? 25 : 0],
  );
  return { id, path };
}
test("cleanup cannot cascade a concurrently attached old upload", async () => {
  const image = await fixtureImage(true),
    post = randomUUID();
  const owner = await db.pool.connect();
  let cleanup: Promise<void> | undefined;
  try {
    await owner.query("BEGIN");
    await owner.query("SELECT pg_advisory_xact_lock(20260929)");
    await social.ownMedia(owner, actor, image.id, "post");
    cleanup = media.cleanup();
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      const activity = await admin.query(
        "SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT pg_advisory_xact_lock%';",
        [database],
      );
      if (activity.rowCount) {
        waiting = true;
        break;
      }
      await new Promise((done) => setTimeout(done, 25));
    }
    assert.equal(
      waiting,
      true,
      "cleanup must wait before taking its orphan snapshot",
    );
    await owner.query(
      "INSERT INTO posts(id,author,body,media_id) VALUES($1,$2,'Synthetic attachment',$3)",
      [post, actor, image.id],
    );
    await owner.query(
      "INSERT INTO post_media(post_id,media_id,position) VALUES($1,$2,0)",
      [post, image.id],
    );
    await owner.query("COMMIT");
    await cleanup;
    assert.equal(
      (await db.pool.query("SELECT media_id FROM posts WHERE id=$1", [post]))
        .rows[0].media_id,
      image.id,
    );
    assert.equal(
      (
        await db.pool.query(
          "SELECT media_id FROM post_media WHERE post_id=$1",
          [post],
        )
      ).rows[0].media_id,
      image.id,
    );
    assert.ok(await stat(image.path));
  } finally {
    await owner.query("ROLLBACK");
    owner.release();
    if (cleanup) await cleanup;
  }
});
test("deletion queue rolls back with account data and retries failed files durably", async () => {
  const image = await fixtureImage();
  await assert.rejects(
    db.tx(async (transaction) => {
      await media.queueMediaDeletion(transaction, [image.path]);
      await transaction.query("DELETE FROM media WHERE id=$1", [image.id]);
      throw new Error("Synthetic rollback");
    }),
    /Synthetic rollback/,
  );
  assert.ok(await stat(image.path));
  assert.equal(
    (await db.pool.query("SELECT 1 FROM media WHERE id=$1", [image.id]))
      .rowCount,
    1,
  );
  assert.equal(
    (
      await db.pool.query("SELECT 1 FROM media_deletion_jobs WHERE path=$1", [
        image.path,
      ])
    ).rowCount,
    0,
  );
  const blocked = join(directory, "synthetic-unlink-failure.jpg");
  await mkdir(blocked);
  await db.tx((transaction) =>
    media.queueMediaDeletion(transaction, [blocked]),
  );
  assert.equal((await media.drainMediaDeletions()).failed, 1);
  const retained = (
    await db.pool.query("SELECT * FROM media_deletion_jobs WHERE path=$1", [
      blocked,
    ])
  ).rows[0];
  assert.equal(retained.attempts, 1);
  assert.ok(retained.last_error);
  await rm(blocked, { recursive: true });
  await writeFile(blocked, "Synthetic retry");
  await db.pool.query(
    "UPDATE media_deletion_jobs SET next_attempt_at=now()-interval '1 second' WHERE path=$1",
    [blocked],
  );
  assert.equal((await media.drainMediaDeletions()).deleted, 1);
  assert.equal(
    (
      await db.pool.query("SELECT 1 FROM media_deletion_jobs WHERE path=$1", [
        blocked,
      ])
    ).rowCount,
    0,
  );
  await assert.rejects(stat(blocked), { code: "ENOENT" });
  await assert.rejects(
    media.queueMediaDeletion(db.pool, [join(directory, "..", "outside.jpg")]),
    /outside private storage/,
  );
  const files = require("node:fs/promises");
  const originalUnlink = files.unlink;
  try {
    files.unlink = async () => {
      throw Object.assign(new Error("Synthetic permission failure"), {
        code: "EACCES",
      });
    };
    const buffer = await readFile(image.path);
    // A failed media INSERT after encoding must retain its file deletion job.
    await assert.rejects(
      media.upload(randomUUID(), {
        buffer,
        size: buffer.length,
        mimetype: "image/jpeg",
      } as Express.Multer.File),
      (error: any) => error.code === "23503",
    );
    const pending = (
      await db.pool.query(
        "SELECT path,last_error FROM media_deletion_jobs WHERE last_error='EACCES'",
      )
    ).rows;
    assert.equal(pending.length, 1);
    assert.ok(await stat(pending[0].path));
  } finally {
    files.unlink = originalUnlink;
  }
  await db.pool.query("UPDATE media_deletion_jobs SET next_attempt_at=now()");
  assert.equal((await media.drainMediaDeletions()).deleted, 1);
  const deleting = randomUUID();
  await db.pool.query(
    "INSERT INTO users(id,email,password_hash,name,birth_date,city) VALUES($1,$2,'synthetic','Synthetic Deletion','1995-01-01','Kathmandu')",
    [deleting, deleting + "@example.test"],
  );
  const transaction = await db.pool.connect();
  let pending: Promise<any> | undefined;
  const before = await readdir(directory);
  try {
    await transaction.query("BEGIN");
    await transaction.query("SELECT pg_advisory_xact_lock(20260929)");
    const selected = await transaction.query(
      "SELECT path FROM media WHERE owner=$1",
      [deleting],
    );
    const buffer = await readFile(image.path);
    pending = media
      .upload(deleting, {
        buffer,
        size: buffer.length,
        mimetype: "image/jpeg",
      } as Express.Multer.File)
      .then(
        () => null,
        (error) => error,
      );
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      const activity = await admin.query(
        "SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT pg_advisory_xact_lock%';",
        [database],
      );
      if (activity.rowCount) {
        waiting = true;
        break;
      }
      await new Promise((done) => setTimeout(done, 25));
    }
    assert.equal(
      waiting,
      true,
      "finishing upload must wait for account deletion's path selection",
    );
    await media.queueMediaDeletion(
      transaction,
      selected.rows.map((row) => row.path),
    );
    await transaction.query("DELETE FROM users WHERE id=$1", [deleting]);
    await transaction.query("COMMIT");
    assert.equal((await pending).code, "23503");
    assert.deepEqual(await readdir(directory), before);
    assert.equal(
      (await db.pool.query("SELECT 1 FROM media WHERE owner=$1", [deleting]))
        .rowCount,
      0,
    );
  } finally {
    await transaction.query("ROLLBACK");
    transaction.release();
    if (pending) await pending;
  }
});
test("orphan video and poster deletion commits to a private ledger and drains once", async () => {
  const id = randomUUID(),
    path = join(directory, id + ".mp4");
  await writeFile(path, "synthetic video");
  await writeFile(path + ".jpg", "synthetic poster");
  await db.pool.query(
    "INSERT INTO media(id,owner,kind,path,mime,created_at) VALUES($1,$2,'video',$3,'video/mp4',now()-interval '25 hours')",
    [id, actor, path],
  );
  await media.cleanup();
  assert.equal(
    (await db.pool.query("SELECT 1 FROM media WHERE id=$1", [id])).rowCount,
    0,
  );
  await assert.rejects(stat(path), { code: "ENOENT" });
  await assert.rejects(stat(path + ".jpg"), { code: "ENOENT" });
  assert.deepEqual(await media.drainMediaDeletions(), {
    deleted: 0,
    failed: 0,
  });
});
test("private media handles missing files and byte ranges without crashing the API", async () => {
  assert.equal((await fetch(api + "/V1/ADMIN/METRICS/")).status, 401);
  const metrics = await fetch(api + "/v1/admin/metrics", {
    headers: { "x-admin-key": "synthetic-security-admin-key" },
  });
  assert.equal(metrics.status, 200);
  const snapshot = await metrics.text();
  assert.equal(snapshot.includes(token), false);
  assert.equal(snapshot.includes(directory), false);
  assert.equal(snapshot.includes(actor), false);
  const image = await fixtureImage();
  const headers = { Authorization: "Bearer " + token };
  assert.equal((await fetch(`${api}/v1/media/${image.id}`)).status, 401);
  const full = await fetch(`${api}/v1/media/${image.id}`, { headers });
  assert.equal(full.status, 200);
  assert.deepEqual(
    Buffer.from(await full.arrayBuffer()),
    await readFile(image.path),
  );
  const range = await fetch(`${api}/v1/media/${image.id}`, {
    headers: { ...headers, Range: "bytes=0-9" },
  });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 10);
  const invalid = await fetch(`${api}/v1/media/${image.id}`, {
    headers: { ...headers, Range: "bytes=999999-" },
  });
  assert.equal(invalid.status, 416);
  await invalid.body?.cancel();
  await rm(image.path);
  const missing = await fetch(`${api}/v1/media/${image.id}`, { headers });
  assert.equal(missing.status, 404);
  await missing.body?.cancel();
  assert.equal((await fetch(api + "/health")).status, 200);
});
test("shared atomic credential quota cannot multiply across limiter instances", async () => {
  const first = limits;
  delete require.cache[require.resolve(resolve("dist/rate-limit.js"))];
  const second: typeof limits = require(resolve("dist/rate-limit.js"));
  const ip = "synthetic-" + randomUUID();
  const results = await Promise.allSettled(
    Array.from({ length: 60 }, (_, i) =>
      (i % 2 ? first : second).enforceIpLimit(ip, "auth"),
    ),
  );
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    40,
  );
  for (const result of results)
    if (result.status === "rejected") {
      assert.equal(result.reason.getStatus(), 429);
      assert.ok(result.reason.retryAfterSeconds > 0);
    }
  const records = (
    await db.pool.query(
      "SELECT key_hash FROM rate_limit_counters WHERE hits=41",
    )
  ).rows;
  assert.ok(records.length);
  assert.match(records[0].key_hash, /^[a-f0-9]{64}$/);
  await db.pool.query(
    "UPDATE rate_limit_counters SET expires_at=now()-interval '1 second' WHERE hits=41",
  );
  await first.enforceIpLimit(ip, "auth");
  assert.equal(limits.requestScope("POST", "/V1/AUTH/LOGIN/"), "auth");
  assert.equal(limits.requestScope("GET", "/V1/auth/config"), "api");
  assert.equal(limits.requestScope("POST", "/v1/auth/demo"), "api");
  assert.equal(
    limits.requestScope("POST", "/V1/VERIFICATION/SEND/"),
    "otp-send",
  );
  await limits.purgeRateLimits();
});
test("per-account report limits and upload admission remain bounded and releasable", async () => {
  const id = randomUUID();
  for (let i = 0; i < 5; i++) await limits.enforceActorLimit(id, "report");
  await assert.rejects(
    limits.enforceActorLimit(id, "report"),
    (error) =>
      error instanceof limits.RateLimitExceeded &&
      error.retryAfterSeconds > 3500,
  );
  assert.equal(
    limits.actionForRoute("POST", "/v1/games/" + partner + "/invite"),
    "game-invite",
  );
  const releases: (() => void)[] = [];
  try {
    releases.push(media.reserveUpload("one"), media.reserveUpload("one"));
    assert.throws(() => media.reserveUpload("one"), /Uploads are busy/);
    releases.push(media.reserveUpload("two"), media.reserveUpload("two"));
    assert.throws(() => media.reserveUpload("three"), /Uploads are busy/);
    releases[0]();
    releases[0]();
    releases.push(media.reserveUpload("three"));
    assert.throws(() => media.reserveUpload("four"), /Uploads are busy/);
  } finally {
    for (const release of releases) release();
  }
  const release = media.reserveUpload("four");
  release();
  const held = [media.reserveUpload(actor), media.reserveUpload(actor)];
  try {
    // Admission runs before Multer: this body would otherwise fail as no file.
    const response = await fetch(api + "/v1/media", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "5");
    await response.body?.cancel();
  } finally {
    for (const release of held) release();
  }
  const buffer = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#aa536b" },
  })
    .jpeg()
    .toBuffer();
  const file = {
    buffer,
    size: buffer.length,
    mimetype: "image/jpeg",
  } as Express.Multer.File;
  const firstUpload = media.upload(actor, file);
  await assert.rejects(
    media.upload(actor, file),
    (error: any) => error.getStatus() === 429,
  );
  const uploaded = await firstUpload;
  assert.equal(uploaded.kind, "image");
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "image/jpeg" }), "photo.jpg");
  const accepted = await fetch(api + "/v1/media", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: form,
  });
  assert.equal(accepted.status, 201);
  await accepted.body?.cancel();
});
test("push claims are shared, retry boundedly and respect current consent", async () => {
  await db.pool.query(
    "INSERT INTO connections(a,b,sender,state) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1,'matched')",
    [actor, partner],
  );
  await db.pool.query(
    "UPDATE users SET push_token='ExpoPushToken[synthetic]' WHERE id=$1",
    [partner],
  );
  const notification = randomUUID();
  await db.pool.query(
    "INSERT INTO notifications(id,recipient,actor,kind,body) VALUES($1,$2,$3,'message','Synthetic notification')",
    [notification, partner, actor],
  );
  const originalFetch = globalThis.fetch;
  let calls = 0;
  process.env.ENABLE_PUSH = "true";
  const modulePath = resolve("dist/push.js");
  const first: typeof import("../src/push") = require(modulePath);
  delete require.cache[require.resolve(modulePath)];
  const second: typeof first = require(modulePath);
  try {
    globalThis.fetch = async () => {
      calls++;
      await new Promise((done) => setTimeout(done, 80));
      return new Response(JSON.stringify({ data: { status: "ok" } }), {
        status: 200,
      });
    };
    await Promise.all([first.dispatchPush(), second.dispatchPush()]);
    assert.equal(calls, 1);
    assert.equal(
      (
        await db.pool.query(
          "SELECT push_state,push_attempts FROM notifications WHERE id=$1",
          [notification],
        )
      ).rows[0].push_state,
      "accepted",
    );
    const failing = randomUUID();
    await db.pool.query(
      "INSERT INTO notifications(id,recipient,actor,kind,body) VALUES($1,$2,$3,'message','Synthetic retry')",
      [failing, partner, actor],
    );
    globalThis.fetch = async () => {
      calls++;
      throw new Error("Synthetic network failure");
    };
    for (let i = 0; i < 3; i++) {
      await db.pool.query(
        "UPDATE push_delivery_claims SET next_attempt_at=now()-interval '1 second' WHERE notification_id=$1",
        [failing],
      );
      await first.dispatchPush();
    }
    assert.equal(
      (
        await db.pool.query(
          "SELECT push_state,push_attempts FROM notifications WHERE id=$1",
          [failing],
        )
      ).rows[0].push_state,
      "failed",
    );
    assert.equal(
      (
        await db.pool.query(
          "SELECT push_attempts FROM notifications WHERE id=$1",
          [failing],
        )
      ).rows[0].push_attempts,
      3,
    );
    const blocked = randomUUID();
    await db.pool.query("INSERT INTO blocks(actor,target) VALUES($1,$2)", [
      partner,
      actor,
    ]);
    await db.pool.query(
      "INSERT INTO notifications(id,recipient,actor,kind,body) VALUES($1,$2,$3,'message','Synthetic blocked')",
      [blocked, partner, actor],
    );
    const before = calls;
    await first.dispatchPush();
    assert.equal(calls, before);
    assert.equal(
      (
        await db.pool.query(
          "SELECT push_state FROM notifications WHERE id=$1",
          [blocked],
        )
      ).rows[0].push_state,
      "skipped",
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env.ENABLE_PUSH = "false";
  }
});
