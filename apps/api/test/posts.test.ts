import { legacyDemoFixture } from "./legacy-demo-fixture";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { dropIsolatedDatabase } from "./database-cleanup";

const base =
  process.env.TEST_DATABASE_URL ||
  "postgres://sangai:local-beta-only@localhost:15432/sangai";
const admin = new Pool({ connectionString: base });
const dbName = "sangai_test_" + randomUUID().replaceAll("-", "");
const url = new URL(base);
url.pathname = "/" + dbName;
const db = new Pool({ connectionString: url.toString() });
let server: ChildProcess;
let uploads: string;
let logs = "";
const port = Number(process.env.TEST_POST_PORT || 4104);
const api = `http://127.0.0.1:${port}/v1`;
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
  "10000000-0000-4000-8000-000000000005",
];
const tokens: string[] = [];
async function call(
  path: string,
  who: number | undefined = 0,
  body?: unknown,
  method?: string,
) {
  const response = await fetch(api + path, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      ...(who === undefined ? {} : { Authorization: "Bearer " + tokens[who] }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
async function image(who = 0) {
  const content = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#b9cb8d" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(content)], { type: "image/png" }),
    "test.png",
  );
  const response = await fetch(api + "/media", {
    method: "POST",
    headers: { Authorization: "Bearer " + tokens[who] },
    body: form,
  });
  assert.equal(response.status, 201);
  return (await response.json()).id as string;
}
before(async () => {
  await admin.query(`CREATE DATABASE ${dbName}`);
  uploads = await mkdtemp(join(tmpdir(), "sangai-test-"));
  server = spawn(process.execPath, ["dist/main.js"], {
    cwd: resolve("."),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      DATABASE_URL: url.toString(),
      ENABLE_DEMO: "true",
      DEMO_MODE: "true",
      // This validation/privacy suite intentionally exceeds ten post attempts
      // per minute. Dedicated security tests exercise limiter boundaries; keep
      // the application's default quota unchanged and raise only this child.
      RATE_POST_PER_MINUTE: "100",
      ADMIN_KEY: "test-admin-private-key",
      UPLOAD_DIR: uploads,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.on("error", (e) => (logs += String(e)));
  server.on("exit", (code) => (logs += " exit=" + code));
  server.stdout?.on("data", (d) => (logs += d));
  server.stderr?.on("data", (d) => (logs += d));
  let ready = false;
  for (let i = 0; i < 250; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready, logs);
  await legacyDemoFixture(db, api, dbName);
  for (const id of ids) {
    const result = await call("/auth/demo", undefined, { id });
    assert.equal(result.status, 201);
    tokens.push(result.data.token);
  }
});
after(async () => {
  server?.kill();
  await new Promise((r) => setTimeout(r, 500));
  await db.end();
  await dropIsolatedDatabase(admin, dbName);
  await admin.end();
  if (uploads) {
    assert.equal(dirname(resolve(uploads)), resolve(tmpdir()));
    assert.ok(basename(uploads).startsWith("sangai-test-"));
    await rm(uploads, { recursive: true, force: true });
  }
});

test("ordered attachments keep legacy clients, retries, exports and retained media intact", async () => {
  const a = await image(),
    b = await image(),
    c = await image();
  const clientId = randomUUID();
  const body = {
    body: "Synthetic carousel privacy check",
    mediaIds: [c, a, b],
    clientId,
  };
  const created = await call("/posts", 0, body);
  assert.equal(created.status, 201);
  const replay = await call("/posts", 0, body);
  assert.equal(replay.data.id, created.data.id);
  assert.equal(
    (await call("/posts", 0, { ...body, mediaIds: [a, b, c] })).status,
    400,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM posts WHERE client_id=$1",
        [clientId],
      )
    ).rows[0].n,
    1,
  );
  const detail = (await call("/posts/" + created.data.id, 1)).data;
  assert.equal(detail.media_id, c);
  assert.deepEqual(
    detail.media.map((m: any) => m.id),
    [c, a, b],
  );
  assert.deepEqual(
    detail.media.map((m: any) => m.position),
    [0, 1, 2],
  );
  assert.ok(
    (await call("/feed", 1)).data.some(
      (p: any) => p.id === created.data.id && p.media.length === 3,
    ),
  );
  for (const mediaId of [a, b, c]) {
    assert.equal((await call("/media/" + mediaId, 1)).status, 200);
    assert.equal((await call("/media/" + mediaId, 3)).status, 404);
  }
  const legacy = await call("/posts", 0, {
    body: "Legacy single photo",
    mediaId: a,
  });
  assert.equal(legacy.status, 201);
  assert.deepEqual(
    (await call("/posts/" + legacy.data.id, 0)).data.media.map(
      (m: any) => m.id,
    ),
    [a],
  );
  const exportData = (await call("/export", 0)).data;
  assert.deepEqual(
    exportData.postMedia
      .filter((m: any) => m.post_id === created.data.id)
      .map((m: any) => m.media_id),
    [c, a, b],
  );
  await db.query(
    "UPDATE media SET created_at=now()-interval '2 days' WHERE id=ANY($1::uuid[])",
    [[a, b, c]],
  );
  const clean = () =>
    spawn(
      process.execPath,
      [
        "-e",
        "const m=require('./dist/media');const d=require('./dist/db');m.cleanup().then(()=>d.pool.end()).catch(()=>d.pool.end().then(()=>process.exit(1)))",
      ],
      {
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: "ignore",
      },
    );
  const cleanupProcess = clean();
  await new Promise<void>((resolve, reject) => {
    cleanupProcess.on("error", reject);
    cleanupProcess.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error("cleanup failed")),
    );
  });
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM media WHERE id=ANY($1::uuid[])",
        [[a, b, c]],
      )
    ).rows[0].n,
    3,
  );
  await call("/posts/" + legacy.data.id, 0, {}, "DELETE");
  assert.equal(
    (await call("/posts/" + created.data.id, 0, {}, "DELETE")).status,
    200,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM post_media WHERE post_id=$1",
        [created.data.id],
      )
    ).rows[0].n,
    0,
  );
  assert.equal((await call("/media/" + b, 1)).status, 404);
});
test("carousel validation is atomic for foreign, private, duplicate, too many and mixed-video attachments", async () => {
  const owned = await image(),
    foreign = await image(1),
    privateImage = await image();
  await db.query("UPDATE media SET purpose='snap' WHERE id=$1", [privateImage]);
  assert.equal(
    (await call("/posts", 0, { body: "Foreign", mediaIds: [owned, foreign] }))
      .status,
    403,
  );
  assert.equal(
    (await db.query("SELECT purpose FROM media WHERE id=$1", [owned])).rows[0]
      .purpose,
    "",
  );
  assert.equal(
    (
      await call("/posts", 0, {
        body: "Private",
        mediaIds: [owned, privateImage],
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/posts", 0, { body: "Duplicate", mediaIds: [owned, owned] }))
      .status,
    400,
  );
  assert.equal(
    (
      await call("/posts", 0, {
        body: "Too many",
        mediaIds: Array.from({ length: 7 }, () => randomUUID()),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/posts", 0, {
        body: "Ambiguous",
        mediaId: owned,
        mediaIds: [owned],
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("/posts", 0, { body: "", mediaIds: [] })).status,
    400,
  );
  const video = randomUUID();
  await db.query(
    "INSERT INTO media(id,owner,kind,path,mime) VALUES($1,$2,'video','fixture.mp4','video/mp4')",
    [video, ids[0]],
  );
  assert.equal(
    (await call("/posts", 0, { body: "Mixed", mediaIds: [owned, video] }))
      .status,
    400,
  );
  assert.equal(
    (await db.query("SELECT purpose FROM media WHERE id=$1", [owned])).rows[0]
      .purpose,
    "",
  );
  assert.equal(
    (await call("/posts", 0, { body: "One video", mediaIds: [video] })).status,
    201,
  );
});
test("every carousel attachment loses access when visibility or mutual matching ends", async () => {
  const images = [await image(), await image()];
  const post = await call("/posts", 0, {
    body: "Revocation check",
    mediaIds: images,
  });
  await call("/settings", 0, { posts_visible: false }, "PATCH");
  for (const mediaId of images)
    assert.equal((await call("/media/" + mediaId, 1)).status, 404);
  assert.equal((await call("/posts/" + post.data.id, 1)).status, 404);
  await call("/settings", 0, { posts_visible: true }, "PATCH");
  assert.equal((await call("/media/" + images[1], 1)).status, 200);
  await call("/block/" + ids[1], 0, {});
  for (const mediaId of images)
    assert.equal((await call("/media/" + mediaId, 1)).status, 404);
  assert.equal((await call("/posts/" + post.data.id, 1)).status, 404);
  assert.ok(
    !(await call("/feed", 1)).data.some((p: any) => p.id === post.data.id),
  );
});
