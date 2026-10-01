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
      DEMO_MODE: "true",
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
  assert.equal(state.circles, undefined);
  assert.equal(state.requests, undefined);
  assert.equal(state.feed.length, 3);
  for (const p of [...state.matches, ...state.discover]) {
    assert.equal(p.email, undefined);
    assert.equal(p.birth_date, undefined);
    assert.equal(p.password_hash, undefined);
    assert.equal(p.preferences, undefined);
  }
});
test("email verification, resumable adult onboarding, isolation and reset replay protection", async () => {
  const registration = await call("/auth/register", undefined, {
    email: "new-beta@example.test",
    password: "original-password",
    acceptedPolicies: true,
  });
  assert.equal(registration.status, 201);
  tokens[5] = registration.data.token;
  const me = (await call("/state", 5)).data.me;
  assert.equal(me.onboarded_at, null);
  assert.equal((await call("/feed", 5)).status, 403);
  assert.equal((await call("/chat/" + ids[0], 5)).status, 403);
  assert.equal((await call("/state", 5)).data.discover.length, 0);
  assert.equal(
    (await call("/onboarding", 5, { step: 0, data: {} }, "PATCH")).status,
    403,
  );
  const addCode = async (purpose: string, code: string) =>
    db.query(
      "INSERT INTO auth_challenges(id,user_id,purpose,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes')",
      [
        randomUUID(),
        me.id,
        purpose,
        createHash("sha256").update(code).digest("hex"),
      ],
    );
  const code = "fixture-verification-code";
  await addCode("verify", code);
  assert.equal(
    (await call("/verification/confirm", 5, { code: "wrong" })).status,
    400,
  );
  assert.equal(
    (
      await db.query("SELECT attempts FROM auth_challenges WHERE user_id=$1", [
        me.id,
      ])
    ).rows[0].attempts,
    1,
  );
  assert.equal((await call("/verification/confirm", 5, { code })).status, 201);
  assert.equal((await call("/verification/confirm", 5, { code })).status, 400);
  assert.equal(
    (
      await call(
        "/onboarding",
        5,
        { step: 4, data: { prompt: "Skip" } },
        "PATCH",
      )
    ).status,
    400,
  );
  const basic = {
    name: "Real Tester",
    birthDate: "2015-01-01",
    city: "Kathmandu",
    gender: "Woman",
    adult: true,
  };
  assert.equal(
    (await call("/onboarding", 5, { step: 0, data: basic }, "PATCH")).status,
    400,
  );
  basic.birthDate = "1997-03-10";
  assert.equal(
    (await call("/onboarding", 5, { step: 0, data: basic }, "PATCH")).status,
    200,
  );
  assert.equal((await call("/state", 5)).data.me.onboarding_step, 1);
  assert.equal((await call("/feed", 5)).status, 403);
  const mediaId = await image(5);
  assert.equal((await call("/profile/photo", 5, { mediaId })).status, 201);
  assert.equal(
    (
      await fetch(api + "/media/" + mediaId, {
        headers: { Authorization: "Bearer " + tokens[0] },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        "/onboarding",
        5,
        {
          step: 1,
          data: { bio: "A real beta profile with a little personality." },
        },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/onboarding",
        5,
        {
          step: 2,
          data: {
            intent: "Casual dating",
            interests: ["Art"],
            languages: ["Nepali"],
            hobbies: [],
          },
        },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/onboarding",
        5,
        {
          step: 3,
          data: {
            preferences: { cities: [], genders: [], minAge: 18, maxAge: 70 },
            lifestyle: {},
            profession: "",
            education: "",
          },
        },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/onboarding",
        5,
        {
          step: 4,
          data: { prompt: "My ideal weekend includes art and coffee." },
        },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.ok((await call("/state", 5)).data.me.onboarded_at);
  assert.equal((await call("/feed", 5)).status, 200);
  assert.equal(
    (await call("/state", 5)).data.discover.length,
    0,
    "Fictional demo users must not enter real discovery",
  );
  await addCode("reset", "fixture-reset-code");
  assert.equal(
    (
      await call("/auth/reset", undefined, {
        email: "new-beta@example.test",
        code: "fixture-reset-code",
        password: "changed-password",
      })
    ).status,
    201,
  );
  assert.equal((await call("/state", 5)).status, 401);
  assert.equal(
    (
      await call("/auth/reset", undefined, {
        email: "new-beta@example.test",
        code: "fixture-reset-code",
        password: "third-password",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/auth/login", undefined, {
        email: "new-beta@example.test",
        password: "original-password",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("/auth/login", undefined, {
        email: "new-beta@example.test",
        password: "changed-password",
      })
    ).status,
    201,
  );
});
test("social content and reactions require current mutual matches", async () => {
  const a = (await call("/state")).data;
  const outsider = (await call("/state", 3)).data;
  assert.equal(outsider.feed.length, 0);
  assert.equal(outsider.stories.length, 0);
  assert.equal(outsider.circles, undefined);
  assert.equal((await call(`/posts/${a.feed[0].id}/react`, 3, {})).status, 404);
  assert.equal(
    (await call(`/posts/${a.feed[0].id}/comments`, 3, { body: "not allowed" }))
      .status,
    404,
  );
  assert.equal((await call(`/follow/${ids[0]}`, 3, {})).status, 404);
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
      await call("/discovery/" + ids[3], 0, {
        action: "like",
        clientId: randomUUID(),
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
test("video upload rejects playlists disguised as video containers", async () => {
  const form = new FormData();
  form.append(
    "file",
    new Blob(["#EXTM3U\n#EXTINF:2,\nhttp://127.0.0.1/private.ts\n"], {
      type: "video/mp4",
    }),
    "fake.mp4",
  );
  const response = await fetch(api + "/media", {
    method: "POST",
    headers: { Authorization: "Bearer " + tokens[0] },
    body: form,
  });
  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).message,
    "Choose an MP4, MOV or WebM video file.",
  );
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
  assert.equal(
    (await call("/stories", 0, { body: "No audience expansion", mediaId }))
      .status,
    403,
  );
  const storyMedia = await image();
  const readStory = () =>
    fetch(api + "/media/" + storyMedia, {
      headers: { Authorization: "Bearer " + tokens[1] },
    });
  const story = await call("/stories", 0, {
    body: "Ephemeral",
    mediaId: storyMedia,
  });
  assert.equal(story.status, 201);
  assert.equal((await readStory()).status, 200);
  await db.query(
    "UPDATE stories SET expires_at=now()-interval '1 second' WHERE id=$1",
    [story.data.id],
  );
  assert.equal((await readStory()).status, 404);
});
test("hidden Likes, idempotent mutual matching, passes, undo and retired routes", async () => {
  assert.equal((await call("/circles", 0, {})).status, 404);
  assert.equal(
    (await call("/connect/" + ids[3], 0, { note: "legacy" })).status,
    404,
  );
  assert.equal(
    (await call("/requests/" + ids[0], 3, { accept: true })).status,
    404,
  );
  const pass = { action: "pass", clientId: randomUUID() };
  assert.equal((await call("/discovery/" + ids[3], 0, pass)).status, 201);
  assert.ok(
    !(await call("/state")).data.discover.some((p: any) => p.id === ids[3]),
  );
  assert.equal(
    (await call("/discovery-undo/" + pass.clientId, 0, {})).status,
    201,
  );
  assert.equal((await call("/discovery/" + ids[3], 0, pass)).status, 409);
  const like = { action: "super", clientId: randomUUID() };
  const sent = await call("/discovery/" + ids[3], 0, like);
  assert.equal(sent.status, 201);
  assert.equal(sent.data.matched, false);
  const hidden = (await call("/state", 3)).data;
  assert.equal(hidden.requests, undefined);
  assert.equal(
    hidden.matches.some((p: any) => p.id === ids[0]),
    false,
  );
  assert.equal(
    hidden.notifications.some((n: any) => n.actor === ids[0]),
    false,
  );
  assert.ok(hidden.discover.some((p: any) => p.id === ids[0]));
  const other = { action: "like", clientId: randomUUID() };
  const pair = await Promise.all([
    call("/discovery/" + ids[0], 3, other),
    call("/discovery/" + ids[0], 3, other),
  ]);
  assert.ok(pair.every((r) => r.status === 201 && r.data.matched));
  const count = await db.query(
    "SELECT count(*)::int AS n FROM connections WHERE a=$1 AND b=$2 AND state='matched'",
    [ids[0], ids[3]],
  );
  assert.equal(count.rows[0].n, 1);
  assert.equal(
    (await call("/discovery-undo/" + like.clientId, 0, {})).status,
    400,
  );
  await call("/unmatch/" + ids[3], 0, {});
  assert.equal(
    (
      await call("/discovery/" + ids[3], 0, {
        action: "like",
        clientId: randomUUID(),
      })
    ).status,
    404,
  );
});
test("game answers are hidden until both play; cannot rewrite after reveal", async () => {
  assert.equal(
    (await call("/games/" + ids[1], 0, { kind: "this-or-that" })).status,
    409,
  );
  await call("/game-ready/" + ids[1], 0, { enabled: true });
  assert.equal((await call("/game-ready/" + ids[0], 2)).data.partner, false);
  await call("/game-ready/" + ids[0], 1, { enabled: true });
  const game = (await call("/games/" + ids[1], 0, { kind: "this-or-that" }))
    .data;
  assert.equal(
    (
      await call("/game/" + game.id + "/answer", 0, {
        answers: [0, 0, 0, 0, 0],
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("/game/" + game.id + "/respond", 0, { response: "accept" }))
      .status,
    403,
  );
  assert.equal(
    (await call("/game/" + game.id + "/respond", 1, { response: "accept" }))
      .status,
    201,
  );
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
test("live-game expiry and Two Truths keep secret lie indices hidden until both guesses", async () => {
  const id = (await call("/games/" + ids[1], 0, { kind: "two-truths" })).data
    .id;
  await db.query(
    "UPDATE game_readiness SET expires_at=now()-interval '1 second' WHERE actor=$1",
    [ids[0]],
  );
  assert.equal(
    (await call("/game/" + id + "/respond", 1, { response: "accept" })).status,
    409,
  );
  await call("/game-ready/" + ids[1], 0, { enabled: true });
  assert.equal(
    (await call("/game/" + id + "/respond", 1, { response: "accept" })).status,
    201,
  );
  await call("/game/" + id + "/answer", 0, {
    answers: { statements: ["I hike", "I paint", "I fly"], lie: 2 },
  });
  let view = (await call("/chat/" + ids[0], 1)).data.games.find(
    (g: any) => g.id === id,
  );
  assert.deepEqual(view.answers, {});
  await call("/game/" + id + "/answer", 1, {
    answers: { statements: ["I cook", "I read", "I ski"], lie: 1 },
  });
  view = (await call("/chat/" + ids[0], 1)).data.games.find(
    (g: any) => g.id === id,
  );
  assert.equal(view.answers[ids[0]].lie, undefined);
  assert.equal(view.answers[ids[0]].statements.length, 3);
  await call("/game/" + id + "/guess", 0, { guess: 1 });
  view = (await call("/chat/" + ids[0], 1)).data.games.find(
    (g: any) => g.id === id,
  );
  assert.deepEqual(view.guesses, {});
  const complete = await call("/game/" + id + "/guess", 1, { guess: 2 });
  assert.equal(complete.data.complete, true);
  assert.equal(complete.data.answers[ids[0]].lie, 2);
  const exp = (await call("/games/" + ids[1], 0, { kind: "this-or-that" })).data
    .id;
  await db.query(
    "UPDATE games SET expires_at=now()-interval '1 second' WHERE id=$1",
    [exp],
  );
  assert.equal(
    (await call("/game/" + exp + "/respond", 1, { response: "accept" })).status,
    409,
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
test("chat media, reply visibility, private saves and shared posts recheck their audience", async () => {
  const mediaId = await image(1);
  const message = await call("/chat/" + ids[0], 1, {
    body: "A regular photo",
    mediaId,
    clientId: randomUUID(),
  });
  assert.equal(message.status, 201);
  const read = (who: number) =>
    fetch(api + "/media/" + mediaId, {
      headers: { Authorization: "Bearer " + tokens[who] },
    });
  assert.equal((await read(0)).status, 200);
  assert.equal((await read(2)).status, 404);
  assert.equal(
    (await call("/posts", 1, { body: "Cannot widen chat media", mediaId }))
      .status,
    403,
  );
  const post = (await call("/posts", 1, { body: "A shared original" })).data;
  await call(`/posts/${post.id}/comments`, 0, { body: "First comment" });
  const parent = (await call(`/posts/${post.id}`, 0)).data.comments[0].id;
  assert.equal(
    (
      await call(`/posts/${post.id}/comments`, 2, {
        body: "A reply",
        parentId: parent,
      })
    ).status,
    201,
  );
  assert.equal(
    (await call(`/posts/${post.id}/save`, 0, { enabled: true })).status,
    201,
  );
  assert.equal(
    (await call("/saved-posts", 0)).data.some((p: any) => p.id === post.id),
    true,
  );
  assert.equal(
    (
      await call(`/posts/${post.id}/share`, 0, {
        target: ids[2],
        clientId: randomUUID(),
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await call(`/posts/${post.id}/share`, 0, {
        target: ids[4],
        clientId: randomUUID(),
      })
    ).status,
    403,
  );
  await call(
    "/settings",
    1,
    {
      posts_visible: false,
      interactions_enabled: false,
      messages_enabled: false,
    },
    "PATCH",
  );
  assert.equal((await call(`/posts/${post.id}`, 0)).status, 404);
  assert.equal(
    (await call("/saved-posts", 0)).data.some((p: any) => p.id === post.id),
    false,
  );
  const shared = (await call("/chat/" + ids[0], 2)).data.timeline.find(
    (m: any) => m.post_id === post.id,
  );
  assert.equal(shared.sharedPost, null);
  assert.equal(
    (
      await call("/chat/" + ids[1], 0, {
        body: "Paused",
        clientId: randomUUID(),
      })
    ).status,
    403,
  );
  await call(
    "/settings",
    1,
    { posts_visible: true, interactions_enabled: true, messages_enabled: true },
    "PATCH",
  );
  const chat = (await call("/chat/" + ids[1], 0)).data;
  assert.ok(
    chat.timeline.some(
      (m: any) => m.id === message.data.id && m.media_id === mediaId,
    ),
  );
});
test("own moments filter before pagination and cursors do not skip tied timestamps", async () => {
  const own = Array.from({ length: 32 }, () => randomUUID());
  const other = Array.from({ length: 35 }, () => randomUUID());
  const all = [...own, ...other];
  try {
    await db.query(
      "INSERT INTO posts(id,author,body,created_at) SELECT x,$2,'Pagination fixture','2099-01-01T00:00:00Z' FROM unnest($1::uuid[]) x",
      [own, ids[0]],
    );
    await db.query(
      "INSERT INTO posts(id,author,body,created_at) SELECT x,$2,'Other fixture','2099-01-02T00:00:00Z' FROM unnest($1::uuid[]) x",
      [other, ids[1]],
    );
    const first = await call("/feed?scope=mine");
    assert.equal(first.status, 200);
    assert.equal(first.data.length, 30);
    assert.ok(
      first.data.every(
        (p: any) => p.author.id === ids[0] && own.includes(p.id),
      ),
    );
    const last = first.data.at(-1);
    const second = await call(
      `/feed?scope=mine&before=${encodeURIComponent(last.created_at)}&beforeId=${last.id}`,
    );
    const selected = [...first.data, ...second.data].filter((p: any) =>
      own.includes(p.id),
    );
    assert.equal(selected.length, 32);
    assert.equal(new Set(selected.map((p: any) => p.id)).size, 32);
    const stranger = await call("/feed?scope=mine", 2);
    assert.ok(stranger.data.every((p: any) => p.author.id === ids[2]));
    assert.equal((await call("/feed?scope=someone-else")).status, 400);
  } finally {
    await db.query("DELETE FROM posts WHERE id=ANY($1::uuid[])", [all]);
  }
});

test("block revokes media, chat and games; unblock does not restore consent", async () => {
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
  const pending = await call("/games/" + ids[1], 0, {
    kind: "would-you-rather",
  });
  assert.equal(pending.status, 201);
  await call("/block/" + ids[1], 0, {});
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
  const exported = await call("/export", 0);
  assert.equal(exported.status, 200);
  assert.equal(exported.data.profile.password_hash, undefined);
  assert.ok(Array.isArray(exported.data.discovery));
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
