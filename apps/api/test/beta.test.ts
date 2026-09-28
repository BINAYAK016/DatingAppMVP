import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

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
const port = Number(process.env.TEST_PORT || 4102);
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
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.end();
  if (uploads) {
    assert.equal(dirname(resolve(uploads)), resolve(tmpdir()));
    assert.ok(basename(uploads).startsWith("sangai-test-"));
    await rm(uploads, { recursive: true, force: true });
  }
});

test("authentication, adult registration and field minimization", async () => {
  assert.equal((await fetch(api + "/state")).status, 401);
  assert.equal(
    (
      await call("/auth/register", undefined, {
        email: "minor@example.test",
        password: "a-test-password",
        name: "Minor",
        city: "Kathmandu",
        birthDate: "2015-01-01",
        acceptedPolicies: true,
      })
    ).status,
    400,
  );
  const registered = await call("/auth/register", undefined, {
    email: "adult@example.test",
    password: "a-test-password",
    name: "Adult",
    city: "Kathmandu",
    birthDate: "1995-01-01",
    acceptedPolicies: true,
  });
  assert.equal(registered.status, 201);
  assert.ok(registered.data.token);
  const login = await call("/auth/login", undefined, {
    email: "adult@example.test",
    password: "a-test-password",
  });
  assert.equal(login.status, 201);
  const state = (await call("/state")).data;
  assert.equal(state.matches.length, 2);
  assert.equal(state.circles.length, 1);
  assert.equal(state.feed.length, 3);
  for (const p of [...state.matches, ...state.discover]) {
    assert.equal(p.email, undefined);
    assert.equal(p.birth_date, undefined);
    assert.equal(p.password_hash, undefined);
    assert.equal(p.preferences, undefined);
  }
});
test("social content and reactions require current mutual matches", async () => {
  const a = (await call("/state")).data;
  const outsider = (await call("/state", 3)).data;
  assert.equal(outsider.feed.length, 0);
  assert.equal(outsider.stories.length, 0);
  assert.equal(outsider.circles.length, 0);
  assert.equal((await call(`/posts/${a.feed[0].id}/react`, 3, {})).status, 404);
  assert.equal(
    (await call(`/posts/${a.feed[0].id}/comments`, 3, { body: "not allowed" }))
      .status,
    404,
  );
  assert.equal((await call(`/follow/${ids[0]}`, 3, {})).status, 403);
  const post = await call("/posts", 0, { body: "A real API test post" });
  assert.equal(post.status, 201);
  assert.equal(
    (
      await call(`/posts/${post.data.id}/comments`, 1, {
        body: "Only matches can reply",
      })
    ).status,
    201,
  );
  assert.equal((await call(`/posts/${post.data.id}/react`, 1, {})).status, 201);
});
test("discovery preferences cannot be bypassed by connecting to a known ID", async () => {
  await db.query(
    `UPDATE users SET preferences=jsonb_set(preferences,'{cities}','["Pokhara"]') WHERE id=$1`,
    [ids[0]],
  );
  assert.equal(
    (
      await call("/connect/" + ids[3], 0, {
        note: "Attempt outside preferences",
      })
    ).status,
    404,
  );
  await db.query(
    `UPDATE users SET preferences=jsonb_set(preferences,'{cities}','[]') WHERE id=$1`,
    [ids[0]],
  );
});
test("feed cursor handles posts with identical timestamps without duplication", async () => {
  const stamp = "2026-01-01T00:00:00.000Z";
  const created = Array.from({ length: 35 }, () => randomUUID());
  for (const id of created)
    await db.query(
      "INSERT INTO posts(id,author,body,created_at) VALUES($1,$2,$3,$4)",
      [id, ids[0], "Pagination test", stamp],
    );
  const first = (await call("/feed?before=2026-01-02T00%3A00%3A00.000Z")).data;
  assert.equal(first.length, 30);
  const last = first.at(-1);
  const second = (
    await call(
      "/feed?before=" +
        encodeURIComponent(last.created_at) +
        "&beforeId=" +
        last.id,
    )
  ).data;
  assert.equal(second.length, 5);
  assert.equal(new Set([...first, ...second].map((p) => p.id)).size, 35);
  await db.query("DELETE FROM posts WHERE id=ANY($1::uuid[])", [created]);
});
test("direct media authorization, view-once snaps and expiry", async () => {
  const mediaId = await image();
  const read = (who: number) =>
    fetch(api + "/media/" + mediaId, {
      headers: { Authorization: "Bearer " + tokens[who] },
    });
  assert.equal((await read(1)).status, 404);
  assert.equal((await read(3)).status, 404);
  const snap = await call("/snaps/" + ids[1], 0, {
    mediaId,
    caption: "A private snap",
  });
  assert.equal(snap.status, 201);
  assert.equal(
    (await call("/snaps/" + snap.data.id + "/open", 2, {})).status,
    404,
  );
  assert.equal(
    (await call("/snaps/" + snap.data.id + "/open", 1, {})).status,
    201,
  );
  assert.equal((await read(1)).status, 200);
  assert.equal(
    (await call("/snaps/" + snap.data.id + "/open", 1, {})).status,
    404,
  );
  await call("/snaps/" + snap.data.id + "/close", 1, {});
  assert.equal((await read(1)).status, 404);
  const expired = await call("/snaps/" + ids[1], 0, { mediaId, caption: "" });
  await db.query(
    "UPDATE snaps SET expires_at=now()-interval '1 second' WHERE id=$1",
    [expired.data.id],
  );
  assert.equal(
    (await call("/snaps/" + expired.data.id + "/open", 1, {})).status,
    404,
  );
  const story = await call("/stories", 0, { body: "Ephemeral", mediaId });
  assert.equal(story.status, 201);
  assert.equal((await read(1)).status, 200);
  await db.query(
    "UPDATE stories SET expires_at=now()-interval '1 second' WHERE id=$1",
    [story.data.id],
  );
  assert.equal((await read(1)).status, 404);
});
test("community creation requires the complete match graph, including non-host pairs", async () => {
  assert.equal(
    (
      await call("/circles", 0, {
        name: "Invalid",
        description: "",
        members: [ids[1], ids[3]],
      })
    ).status,
    403,
  );
  await call("/connect/" + ids[3], 0, { note: "Test hello" });
  await call("/requests/" + ids[0], 3, { accept: true });
  // Host is matched with both invitees, but invitees are not matched to each other.
  assert.equal(
    (
      await call("/circles", 0, {
        name: "Host-only is insufficient",
        description: "",
        members: [ids[1], ids[3]],
      })
    ).status,
    403,
  );
  const circle = await call("/circles", 0, {
    name: "Valid circle",
    description: "Private",
    members: [ids[1], ids[2]],
  });
  assert.equal(circle.status, 201);
  assert.equal((await call("/circles/" + circle.data.id, 4)).status, 404);
  assert.equal(
    (
      await call("/circles/" + circle.data.id + "/posts", 1, {
        body: "Hello circle",
      })
    ).status,
    201,
  );
  const event = await call("/circles/" + circle.data.id + "/events", 1, {
    title: "Coffee walk",
    venue: "Public café",
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(event.status, 201);
  assert.equal(
    (await call("/events/" + event.data.id + "/rsvp", 2, {})).status,
    201,
  );
  assert.equal(
    (await call("/events/" + event.data.id + "/rsvp", 4, {})).status,
    404,
  );
});
test("game answers are hidden until both play; cannot rewrite after reveal", async () => {
  const game = (await call("/games/" + ids[1], 0, { kind: "this-or-that" }))
    .data;
  const answer = await call("/game/" + game.id + "/answer", 0, {
    answers: [0, 1, 0, 1, 0],
  });
  assert.equal(answer.status, 201);
  const other = (await call("/chat/" + ids[0], 1)).data.games.find(
    (g: any) => g.id === game.id,
  );
  assert.deepEqual(other.answers, {});
  assert.equal(other.complete, false);
  assert.equal(
    (
      await call("/game/" + game.id + "/answer", 2, {
        answers: [0, 0, 0, 0, 0],
      })
    ).status,
    404,
  );
  const reveal = await call("/game/" + game.id + "/answer", 1, {
    answers: [1, 1, 0, 1, 1],
  });
  assert.equal(reveal.data.complete, true);
  assert.equal(Object.keys(reveal.data.answers).length, 2);
  assert.equal(
    (
      await call("/game/" + game.id + "/answer", 0, {
        answers: [1, 1, 1, 1, 1],
      })
    ).status,
    400,
  );
});
test("chat retries are idempotent and only invited partner can accept a date", async () => {
  const payload = { body: "Exactly one message", clientId: randomUUID() };
  const [a, b] = await Promise.all([
    call("/chat/" + ids[1], 0, payload),
    call("/chat/" + ids[1], 0, payload),
  ]);
  assert.equal(a.data.id, b.data.id);
  const plan = (
    await call("/plans/" + ids[1], 0, {
      title: "A date",
      venue: "Public park",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    })
  ).data;
  assert.equal(
    (await call("/plan/" + plan.id, 0, { state: "accepted" })).status,
    403,
  );
  assert.equal(
    (await call("/plan/" + plan.id, 1, { state: "accepted" })).status,
    201,
  );
});
test("block revokes media, chat and complete communities, including an unaffected third member", async () => {
  const departed = (
    await call("/circles", 0, {
      name: "Former member check",
      description: "",
      members: [ids[1], ids[2]],
    })
  ).data;
  await call("/circles/" + departed.id + "/posts", 1, {
    body: "Former member content",
  });
  await call("/circles/" + departed.id + "/leave", 1, {});
  const state = (await call("/state")).data;
  const circle = state.circles.find(
    (c: any) =>
      c.members.some((p: any) => p.id === ids[2]) &&
      c.members.some((p: any) => p.id === ids[1]),
  );
  const mediaId = await image(1);
  await call("/posts", 1, { body: "Private", mediaId });
  assert.equal(
    (
      await fetch(api + "/media/" + mediaId, {
        headers: { Authorization: "Bearer " + tokens[0] },
      })
    ).status,
    200,
  );
  const pending = await call("/games/" + ids[1], 0, { kind: "date-builder" });
  assert.equal(pending.status, 201);
  await call("/block/" + ids[1], 0, {});
  const former = (await call("/circles/" + departed.id, 0)).data;
  assert.equal(former.posts.length, 0);
  assert.equal((await call("/chat/" + ids[1], 0)).status, 403);
  assert.equal(
    (await call("/chat/" + ids[0], 1, { body: "No", clientId: randomUUID() }))
      .status,
    403,
  );
  assert.equal(
    (
      await fetch(api + "/media/" + mediaId, {
        headers: { Authorization: "Bearer " + tokens[0] },
      })
    ).status,
    404,
  );
  assert.equal((await call("/circles/" + circle.id, 2)).status, 403);
  assert.equal(
    (await call("/state", 2)).data.circles.some((c: any) => c.id === circle.id),
    false,
  );
  assert.equal(
    (
      await call("/game/" + pending.data.id + "/answer", 1, {
        answers: [0, 0, 0, 0, 0],
      })
    ).status,
    403,
  );
  await call("/block/" + ids[1], 0, {}, "DELETE");
  assert.equal((await call("/chat/" + ids[1], 0)).status, 403);
});
test("report privacy, admin authorization and account deletion revoke sessions", async () => {
  const report = await call("/reports", 0, {
    target: ids[4],
    reason: "Test incident",
    context: "test",
  });
  assert.equal(report.status, 201);
  assert.equal((await call("/reports", 4)).data.length, 0);
  assert.equal((await fetch(api + "/admin/reports")).status, 401);
  const response = await fetch(api + "/admin/reports/" + report.data.id, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": "test-admin-private-key",
    },
    body: JSON.stringify({
      action: "resolve",
      resolution: "Reviewed for test",
    }),
  });
  assert.equal(response.status, 201);
  assert.equal((await call("/reports", 0)).data[0].state, "resolved");
  assert.equal(
    (await call("/account", 4, { confirm: "DELETE" }, "DELETE")).status,
    200,
  );
  assert.equal((await call("/state", 4)).status, 401);
});
