import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Pool } from "pg";

// The suite owns its database and private storage. It never starts, resets,
// truncates, or changes fixtures in the shared local beta database.
const base =
  process.env.TEST_DATABASE_URL ||
  "postgres://sangai:local-beta-only@localhost:15432/sangai";
const name = "sangai_demo_world_" + randomUUID().replaceAll("-", "");
const url = new URL(base);
url.pathname = "/" + name;
const admin = new Pool({ connectionString: base });
const fixture = new Pool({ connectionString: url.toString() });
let db: typeof import("../src/db");
let world: typeof import("../src/demoWorld");
let catalog: typeof import("../src/demoPersonas");
let discovery: typeof import("../src/discovery");
let social: typeof import("../src/social");
let media: typeof import("../src/media");
let interactions: typeof import("../src/interactions");
let games: typeof import("../src/game-v2");
let auth: typeof import("../src/auth");
let storage: string;
let first: any;
const normal = randomUUID(),
  normalPartner = randomUUID(),
  normalPost = randomUUID(),
  normalMedia = randomUUID();
const normalToken = randomUUID(),
  demoToken = randomUUID();
let normalHash: string;
const id = (index: number) => catalog.id(index);
const entity = (kind: string, key: string) => catalog.demoEntityId(kind, key);
function owned() {
  assert.match(name, /^sangai_demo_world_[a-f0-9]{32}$/);
  assert.equal(url.pathname, "/" + name);
  assert.notEqual(new URL(base).pathname, url.pathname);
}
function ownStorage() {
  assert.equal(dirname(resolve(storage)), resolve(tmpdir()));
  assert.match(basename(storage), /^sangai-demo-world-/);
}
async function normalSnapshot() {
  const found = await fixture.query(
    `SELECT jsonb_build_object(
    'users',(SELECT jsonb_agg(u ORDER BY id) FROM users u WHERE id=ANY($1::uuid[])),
    'sessions',(SELECT jsonb_agg(s ORDER BY token_hash) FROM sessions s WHERE user_id=ANY($1::uuid[])),
    'media',(SELECT jsonb_agg(m ORDER BY id) FROM media m WHERE owner=ANY($1::uuid[])),
    'posts',(SELECT jsonb_agg(p ORDER BY id) FROM posts p WHERE author=ANY($1::uuid[])),
    'connections',(SELECT jsonb_agg(c ORDER BY a,b) FROM connections c WHERE a=ANY($1::uuid[]) AND b=ANY($1::uuid[])),
    'messages',(SELECT jsonb_agg(m ORDER BY id) FROM messages m WHERE sender=ANY($1::uuid[]) AND recipient=ANY($1::uuid[]))
  ) AS data`,
    [[normal, normalPartner]],
  );
  return createHash("sha256")
    .update(JSON.stringify(found.rows[0].data))
    .digest("hex");
}
async function worldSnapshot() {
  const found = await fixture.query(
    `SELECT jsonb_build_object(
    'users',(SELECT jsonb_agg(u ORDER BY id) FROM users u WHERE id=ANY($1::uuid[])),
    'media',(SELECT jsonb_agg(m ORDER BY id) FROM media m WHERE owner=ANY($1::uuid[])),
    'posts',(SELECT jsonb_agg(p ORDER BY id) FROM posts p WHERE author=ANY($1::uuid[])),
    'messages',(SELECT jsonb_agg(m ORDER BY id) FROM messages m WHERE sender=ANY($1::uuid[]) AND recipient=ANY($1::uuid[])),
    'games',(SELECT jsonb_agg(g ORDER BY id) FROM games g WHERE host=ANY($1::uuid[]) AND guest=ANY($1::uuid[])),
    'metadata',(SELECT to_jsonb(d) FROM demo_world_metadata d WHERE singleton)
  ) AS data`,
    [catalog.demoIds],
  );
  return createHash("sha256")
    .update(JSON.stringify(found.rows[0].data))
    .digest("hex");
}
const isStatus = (status: number) => (error: any) =>
  error.getStatus?.() === status;
async function allCandidates(actor: string) {
  const result: any[] = [];
  let cursor: string | undefined;
  do {
    const page = await db.readTx((client) =>
      discovery.candidatesPage(client, actor, cursor, 3),
    );
    assert.ok(page.items.length <= 3);
    result.push(...page.items);
    cursor = page.nextCursor || undefined;
  } while (cursor);
  return result;
}

before(async () => {
  owned();
  await admin.query(`CREATE DATABASE ${name}`);
  storage = await mkdtemp(join(tmpdir(), "sangai-demo-world-"));
  ownStorage();
  process.env.DATABASE_URL = url.toString();
  process.env.UPLOAD_DIR = storage;
  process.env.ENABLE_DEMO = "true";
  process.env.DEMO_MODE = "true";
  process.env.ENABLE_GAMES_V2 = "true";
  process.env.ENABLE_PUSH = "false";
  db = await import("../src/db");
  await db.migrate();
  catalog = await import("../src/demoPersonas");
  world = await import("../src/demoWorld");
  discovery = await import("../src/discovery");
  social = await import("../src/social");
  media = await import("../src/media");
  interactions = await import("../src/interactions");
  games = await import("../src/game-v2");
  auth = await import("../src/auth");
  // A realistic upgrade target already contains normal data and the original
  // five demo identities/sessions. The seed must not rely on an empty users table.
  for (const user of [normal, normalPartner])
    await fixture.query(
      "INSERT INTO users(id,email,password_hash,name,birth_date,city,email_verified_at,adult_declared_at,onboarded_at) VALUES($1,$2,'normal-never-login','Existing normal fixture','1990-01-01','Kathmandu',now(),now(),now())",
      [user, user + "@example.test"],
    );
  for (const user of catalog.demoIds.slice(0, 5))
    await fixture.query(
      "INSERT INTO users(id,email,password_hash,name,birth_date,city,demo) VALUES($1,$2,'legacy-never-login','Legacy demo fixture','1995-01-01','Kathmandu',true)",
      [user, user + "@sangai.invalid"],
    );
  for (const [user, token] of [
    [normal, normalToken],
    [id(1), demoToken],
  ])
    await fixture.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",
      [auth.digest(token), user],
    );
  const path = join(storage, "normal-owned-preserve.jpg");
  await writeFile(path, "unchanged-normal-byte-fixture");
  await fixture.query(
    "INSERT INTO media(id,owner,kind,path,mime,purpose) VALUES($1,$2,'image',$3,'image/jpeg','post')",
    [normalMedia, normal, path],
  );
  await fixture.query(
    "INSERT INTO posts(id,author,body,media_id) VALUES($1,$2,'Existing normal post',$3)",
    [normalPost, normal, normalMedia],
  );
  await fixture.query(
    "INSERT INTO post_media(post_id,media_id,position) VALUES($1,$2,0)",
    [normalPost, normalMedia],
  );
  await fixture.query(
    "INSERT INTO connections(a,b,sender,state) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1,'matched')",
    [normal, normalPartner],
  );
  await fixture.query(
    "INSERT INTO messages(id,sender,recipient,body,client_id) VALUES($1,$2,$3,'Existing normal message','normal-preserve')",
    [randomUUID(), normal, normalPartner],
  );
  normalHash = await normalSnapshot();
  first = await world.initializeDemoWorld();
});
after(async () => {
  await db?.pool.end();
  await fixture.end();
  owned();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.end();
  if (storage) {
    ownStorage();
    await rm(storage, { recursive: true, force: true });
  }
});

test("versioned upgrade creates exactly 30 complete synthetic profiles beside unchanged normal data", async () => {
  assert.equal(first.initialized, true);
  assert.deepEqual(first.counts, {
    users: 30,
    matches: 8,
    messages: 90,
    posts: 50,
    stories: 10,
    snaps: 3,
    games: 3,
    plans: 2,
  });
  assert.equal(
    (await fixture.query("SELECT count(*)::int AS total FROM users WHERE demo"))
      .rows[0].total,
    30,
  );
  assert.deepEqual(world.demoConfig().groups, {
    men: 10,
    women: 10,
    lgbtq: 10,
  });
  for (const p of catalog.demoPersonas) {
    const user = (
      await fixture.query("SELECT * FROM users WHERE id=$1", [p.id])
    ).rows[0];
    assert.ok(
      user.demo &&
        user.avatar_id &&
        user.onboarded_at &&
        user.adult_declared_at,
    );
    assert.ok(
      user.bio &&
        user.prompt &&
        user.profession &&
        user.education &&
        user.interests.length &&
        user.hobbies.length &&
        user.languages.length,
    );
    assert.equal(user.name, p.profile.name);
    assert.ok(p.age >= 21 && p.age <= 35);
    assert.equal(user.push_token, null);
    assert.equal(user.notifications, false);
    assert.equal(user.email_verified_at, null);
    assert.match(user.email, /@sangai\.invalid$/);
  }
  assert.equal(await normalSnapshot(), normalHash);
  assert.equal(await auth.authenticate(`Bearer ${normalToken}`), normal);
  assert.equal(await auth.authenticate(`Bearer ${demoToken}`), id(1));
  assert.equal(
    await readFile(join(storage, "normal-owned-preserve.jpg"), "utf8"),
    "unchanged-normal-byte-fixture",
  );
});

test("selector cursor pages only six profiles by default and at most ten without private fields", async () => {
  const seen: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await world.demoUsersPage({ cursor });
    assert.ok(page.items.length <= 6);
    for (const item of page.items) {
      assert.ok(
        item.demo_group &&
          item.orientation &&
          item.pronouns &&
          item.looking_for.length,
      );
      for (const key of [
        "email",
        "birth_date",
        "password_hash",
        "preferences",
        "push_token",
      ])
        assert.equal(key in item, false);
      seen.push(item.id);
    }
    cursor = page.nextCursor || undefined;
  } while (cursor);
  assert.deepEqual(seen, catalog.demoIds);
  assert.equal(new Set(seen).size, 30);
  for (const group of ["men", "women", "lgbtq"]) {
    const page = await world.demoUsersPage({ group, limit: 10 });
    assert.equal(page.items.length, 10);
    assert.equal(page.nextCursor, null);
    assert.ok(page.items.every((p) => p.demo_group === group));
  }
  const next = (await world.demoUsersPage({ group: "women", limit: 3 }))
    .nextCursor!;
  await assert.rejects(
    world.demoUsersPage({ group: "men", cursor: next }),
    isStatus(400),
  );
  await assert.rejects(
    world.demoUsersPage({ cursor: "malformed" }),
    isStatus(400),
  );
  await assert.rejects(world.demoUsersPage({ limit: 11 }));
  await fixture.query("UPDATE users SET suspended=true WHERE id=$1", [id(2)]);
  try {
    const page = await world.demoUsersPage({ group: "women", limit: 3 });
    assert.equal(page.items.length, 3);
    assert.equal(
      page.items.some((p) => p.id === id(2)),
      false,
    );
  } finally {
    await fixture.query("UPDATE users SET suspended=false WHERE id=$1", [
      id(2),
    ]);
  }
});

test("all 30 discovery results match independent reciprocal preference and scenario expectations", async () => {
  for (const persona of catalog.demoPersonas) {
    const actual = (await allCandidates(persona.id)).map((p) => p.id).sort();
    const expected = catalog
      .expectedDemoCandidates(persona, {
        ...world.demoScenarioContext,
        at: new Date(),
      })
      .sort();
    assert.deepEqual(actual, expected, persona.profile.name);
    assert.ok(
      actual.length >= 2,
      `${persona.profile.name} must still have two genuine eligible prospects`,
    );
  }
  assert.deepEqual(
    (await allCandidates(id(1))).map((p) => p.id),
    [id(19), id(27)],
  );
  assert.equal(
    (
      await fixture.query(
        "SELECT count(*)::int AS total FROM discovery_actions WHERE undone_at IS NULL",
      )
    ).rows[0].total,
    19,
  );
  for (const [a, b] of world.demoMatches)
    assert.equal(await db.matched(fixture, a, b), true);
  assert.equal(await db.matched(fixture, id(1), id(17)), false);
});

test("real private feed and timeline pages expose 40 hub posts and complete long chat without duplicates", async () => {
  const firstPage = await db.readTx((client) => social.feed(client, id(1)));
  assert.equal(firstPage.length, 30);
  const last = firstPage.at(-1)!;
  const secondPage = await db.readTx((client) =>
    social.feed(client, id(1), last.created_at, last.id),
  );
  assert.equal(secondPage.length, 10);
  const visible = [...firstPage, ...secondPage];
  assert.equal(new Set(visible.map((p) => p.id)).size, 40);
  assert.ok(
    visible.every((p) => [id(1), id(2), id(3), id(26)].includes(p.author.id)),
  );
  assert.ok(
    visible.some((p) => p.kind === "video") &&
      visible.some((p) => p.media.length === 6) &&
      visible.some((p) => p.comments.length),
  );
  const current = await interactions.conversation(id(1), id(3));
  assert.equal(current.timeline.length, 50);
  assert.equal(current.hasMore, true);
  const oldest = current.timeline[0];
  const older = await interactions.conversation(
    id(1),
    id(3),
    oldest.created_at,
    oldest.id,
  );
  const all = [...older.timeline, ...current.timeline];
  assert.equal(all.filter((m) => m.type === "message").length, 76);
  assert.equal(new Set(all.map((m) => m.id)).size, all.length);
  assert.equal(
    (await interactions.conversation(id(4), id(5))).timeline.length,
    0,
  );
});

test("demo-only profile preview never grants social media or normal-account access and obeys blocks", async () => {
  const stranger = id(21),
    owner = id(1);
  const profile = await discovery.visibleProfile(stranger, owner);
  assert.equal(profile.id, owner);
  const avatar = await media.authorizedMedia(stranger, profile.avatar_id);
  assert.equal(avatar.owner, owner);
  const postImage = entity("media", "1:feed:0");
  await assert.rejects(
    media.authorizedMedia(stranger, postImage),
    isStatus(404),
  );
  await assert.rejects(
    media.authorizedMedia(normal, profile.avatar_id),
    isStatus(404),
  );
  await assert.rejects(discovery.visibleProfile(normal, owner), isStatus(404));
  process.env.DEMO_MODE = "false";
  try {
    await assert.rejects(
      discovery.visibleProfile(stranger, owner),
      isStatus(404),
    );
    await assert.rejects(
      media.authorizedMedia(stranger, profile.avatar_id),
      isStatus(404),
    );
  } finally {
    process.env.DEMO_MODE = "true";
  }
  await fixture.query("INSERT INTO blocks(actor,target) VALUES($1,$2)", [
    stranger,
    owner,
  ]);
  try {
    await assert.rejects(
      discovery.visibleProfile(stranger, owner),
      isStatus(404),
    );
    await assert.rejects(
      media.authorizedMedia(stranger, profile.avatar_id),
      isStatus(404),
    );
  } finally {
    await fixture.query("DELETE FROM blocks WHERE actor=$1 AND target=$2", [
      stranger,
      owner,
    ]);
  }
});

test("real story visibility and view-once snaps keep unopened/expired media private", async () => {
  const stories = await social.storiesPage(id(1));
  assert.equal(stories.items.length, 7);
  assert.equal(stories.items.filter((s) => s.author.id === id(2)).length, 4);
  assert.equal(
    stories.items.some((s) => s.kind === "video"),
    true,
  );
  const expired = await social.storiesPage(id(4));
  assert.equal(
    expired.items.some((s) => s.author.id === id(5)),
    false,
  );
  await assert.rejects(
    media.authorizedMedia(id(4), entity("media", "5:story:0")),
    isStatus(404),
  );
  const snap = entity("snap", "2-1"),
    snapMedia = entity("media", "2:story:3");
  await assert.rejects(media.authorizedMedia(id(1), snapMedia), isStatus(404));
  await assert.rejects(interactions.openSnap(id(3), snap), isStatus(404));
  const opened = await interactions.openSnap(id(1), snap);
  assert.equal(opened.mediaId, snapMedia);
  assert.ok(new Date(opened.viewUntil).getTime() > Date.now());
  assert.equal((await media.authorizedMedia(id(1), snapMedia)).owner, id(2));
  await assert.rejects(interactions.openSnap(id(1), snap), isStatus(404));
  await interactions.closeSnap(id(1), snap);
  await assert.rejects(media.authorizedMedia(id(1), snapMedia), isStatus(404));
});

test("seeded game states come from consent/events/results and hide unfinished partner choices", async () => {
  const pending = await games.read(id(1), entity("game", "pending"));
  const active = await games.read(id(3), entity("game", "active"));
  const complete = await games.read(id(26), entity("game", "complete"));
  assert.equal(pending.state, "invited");
  assert.equal(pending.accepted_at, null);
  assert.equal(active.state, "active");
  assert.ok(active.accepted_at);
  assert.equal(active.results, null);
  assert.equal("state_data" in active, false);
  assert.equal("answers" in active, false);
  assert.deepEqual(active.view.myChoices, {});
  assert.equal(complete.state, "complete");
  assert.ok(complete.results);
  const events = await fixture.query(
    "SELECT g.state,count(e.id)::int AS events FROM games g JOIN game_events e ON e.game_id=g.id GROUP BY g.state ORDER BY g.state",
  );
  assert.deepEqual(events.rows, [
    { state: "active", events: 3 },
    { state: "complete", events: 12 },
    { state: "invited", events: 1 },
  ]);
  assert.equal(
    (await fixture.query("SELECT count(*)::int AS total FROM game_results"))
      .rows[0].total,
    1,
  );
  const available = await games.catalog(id(4), id(5));
  assert.equal(available.games.length, 7);
  assert.equal(available.current, null);
});

test("a restart preserves demo edits/activity and either disabled demo flag closes reset and selector", async () => {
  await fixture.query(
    "UPDATE users SET bio='Edited synthetic demo bio' WHERE id=$1",
    [id(1)],
  );
  await interactions.sendMessage(id(1), id(2), {
    body: "A synthetic message that must survive ordinary startup.",
    clientId: "startup-preserve",
  });
  const snapshot = await worldSnapshot();
  assert.deepEqual(await world.initializeDemoWorld(), { initialized: false });
  assert.equal(await worldSnapshot(), snapshot);
  for (const flag of ["DEMO_MODE", "ENABLE_DEMO"]) {
    process.env[flag] = "false";
    try {
      assert.equal(world.demoConfig().enabled, false);
      await assert.rejects(world.resetDemoWorld(id(1)), isStatus(403));
      await assert.rejects(world.demoUsersPage(), isStatus(403));
      assert.deepEqual(await world.initializeDemoWorld(), {
        initialized: false,
      });
    } finally {
      process.env[flag] = "true";
    }
  }
  await assert.rejects(world.resetDemoWorld(normal), isStatus(403));
  assert.equal(await normalSnapshot(), normalHash);
});

test("confirmed reset restores stable scenarios while preserving sessions/normal records and rotating only private paths", async () => {
  await discovery.swipe(id(1), id(27), {
    action: "like",
    clientId: randomUUID(),
  });
  assert.equal(
    (
      await discovery.swipe(id(27), id(1), {
        action: "like",
        clientId: randomUUID(),
      })
    ).matched,
    true,
  );
  const old = (
    await fixture.query("SELECT path FROM media WHERE id=$1", [
      entity("media", "1:avatar:0"),
    ])
  ).rows[0].path;
  const result = await world.resetDemoWorld(id(1));
  assert.deepEqual(result.counts, first.counts);
  assert.deepEqual(result.inventory, first.inventory);
  assert.equal(await db.matched(fixture, id(1), id(27)), false);
  assert.equal(
    (await fixture.query("SELECT bio FROM users WHERE id=$1", [id(1)])).rows[0]
      .bio,
    catalog.demoPersonas[0].profile.bio,
  );
  const current = (
    await fixture.query("SELECT path FROM media WHERE id=$1", [
      entity("media", "1:avatar:0"),
    ])
  ).rows[0].path;
  assert.notEqual(current, old);
  assert.ok(current.startsWith(storage));
  assert.ok(
    (
      await fixture.query("SELECT 1 FROM media_deletion_jobs WHERE path=$1", [
        old,
      ])
    ).rowCount,
  );
  await media.drainMediaDeletions(100);
  assert.ok((await readFile(current)).length > 100);
  assert.equal(await auth.authenticate(`Bearer ${demoToken}`), id(1));
  assert.equal(await normalSnapshot(), normalHash);
  assert.equal(
    await readFile(join(storage, "normal-owned-preserve.jpg"), "utf8"),
    "unchanged-normal-byte-fixture",
  );
  assert.equal(
    (
      await fixture.query("SELECT opened_at FROM snaps WHERE id=$1", [
        entity("snap", "2-1"),
      ])
    ).rows[0].opened_at,
    null,
  );
  assert.equal(
    (
      await fixture.query(
        "SELECT count(*)::int AS total FROM notifications WHERE recipient=ANY($1::uuid[]) AND push_state<>'skipped'",
        [catalog.demoIds],
      )
    ).rows[0].total,
    0,
  );
});

test("failure halfway through reset rolls back all existing activity and media references", async () => {
  const snapshot = await worldSnapshot();
  await fixture.query(
    "CREATE FUNCTION reject_demo_post() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated reset failure'; END $$",
  );
  await fixture.query(
    "CREATE TRIGGER reject_demo_post BEFORE INSERT ON posts FOR EACH ROW EXECUTE FUNCTION reject_demo_post()",
  );
  try {
    await assert.rejects(world.resetDemoWorld(id(1)), /isolated reset failure/);
    assert.equal(await worldSnapshot(), snapshot);
    assert.equal(await normalSnapshot(), normalHash);
  } finally {
    await fixture.query("DROP TRIGGER reject_demo_post ON posts");
    await fixture.query("DROP FUNCTION reject_demo_post()");
  }
});

test("legacy cross-world comment descendants fail closed instead of cascading normal replies", async () => {
  const parent = randomUUID(),
    child = randomUUID();
  await fixture.query(
    "INSERT INTO comments(id,post_id,author,body) VALUES($1,$2,$3,'Legacy synthetic parent')",
    [parent, normalPost, id(1)],
  );
  await fixture.query(
    "INSERT INTO comments(id,post_id,author,body,parent_id) VALUES($1,$2,$3,'Existing normal reply',$4)",
    [child, normalPost, normal, parent],
  );
  const snapshot = await worldSnapshot();
  try {
    await assert.rejects(world.resetDemoWorld(id(1)), isStatus(409));
    assert.equal(await worldSnapshot(), snapshot);
    assert.equal(
      (await fixture.query("SELECT body FROM comments WHERE id=$1", [child]))
        .rows[0].body,
      "Existing normal reply",
    );
  } finally {
    await fixture.query("DELETE FROM comments WHERE id=$1", [child]);
    await fixture.query("DELETE FROM comments WHERE id=$1", [parent]);
  }
});

test("a normal user/media identifier collision never converts or overwrites normal ownership", async () => {
  const target = id(30);
  await fixture.query("UPDATE users SET demo=false WHERE id=$1", [target]);
  try {
    await assert.rejects(world.resetDemoWorld(id(1)), isStatus(409));
    assert.equal(
      (await fixture.query("SELECT demo FROM users WHERE id=$1", [target]))
        .rows[0].demo,
      false,
    );
  } finally {
    await fixture.query("UPDATE users SET demo=true WHERE id=$1", [target]);
  }
  const mediaId = entity("media", "1:avatar:0");
  await fixture.query("UPDATE media SET owner=$2 WHERE id=$1", [
    mediaId,
    normal,
  ]);
  try {
    await assert.rejects(world.resetDemoWorld(id(1)), isStatus(409));
    assert.equal(
      (await fixture.query("SELECT owner FROM media WHERE id=$1", [mediaId]))
        .rows[0].owner,
      normal,
    );
  } finally {
    await fixture.query("UPDATE media SET owner=$2 WHERE id=$1", [
      mediaId,
      id(1),
    ]);
  }
  assert.equal(await normalSnapshot(), normalHash);
});

test("an older server cannot reset a newer installed demo world", async () => {
  await fixture.query(
    "UPDATE demo_world_metadata SET version=2 WHERE singleton",
  );
  const snapshot = await worldSnapshot();
  try {
    assert.deepEqual(await world.initializeDemoWorld(), { initialized: false });
    await assert.rejects(world.resetDemoWorld(id(1)), isStatus(409));
    assert.equal(await worldSnapshot(), snapshot);
  } finally {
    await fixture.query(
      "UPDATE demo_world_metadata SET version=1 WHERE singleton",
    );
  }
});

test("reset commits on its locked client even when every other pool slot is occupied", async () => {
  const held = await Promise.all(
    Array.from({ length: 9 }, () => db.pool.connect()),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = world.resetDemoWorld(id(1));
  try {
    const result = await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error("Reset waited for a second pooled connection")),
          25000,
        );
      }),
    ]);
    assert.deepEqual(result.counts, first.counts);
    assert.equal(await normalSnapshot(), normalHash);
  } finally {
    if (timer) clearTimeout(timer);
    for (const client of held) client.release();
    await pending.catch(() => {});
  }
});

test("two concurrent resets admit one world restore and reject the other with retryable 429", async () => {
  const barrier = await fixture.connect();
  await barrier.query("BEGIN");
  await barrier.query("SELECT pg_advisory_xact_lock(20260929)");
  const firstReset = world.resetDemoWorld(id(1));
  try {
    let admitted = false;
    for (let attempt = 0; attempt < 200 && !admitted; attempt++) {
      admitted = (
        await fixture.query(
          "SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=20261002 AND granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())) AS admitted",
        )
      ).rows[0].admitted;
      if (!admitted) await new Promise((done) => setTimeout(done, 10));
    }
    assert.equal(
      admitted,
      true,
      "The first coordinator must hold the world admission lock",
    );
    await assert.rejects(world.resetDemoWorld(id(2)), isStatus(429));
  } finally {
    await barrier.query("ROLLBACK");
    barrier.release();
  }
  const accepted = await firstReset;
  assert.deepEqual(accepted.counts, first.counts);
  assert.equal(await normalSnapshot(), normalHash);
});

test("legacy demo listing and sign-in exclude unrelated demo records without deleting them", async () => {
  const unrelated = randomUUID(),
    existingToken = randomUUID();
  await fixture.query(
    "INSERT INTO users(id,email,password_hash,name,birth_date,city,demo) VALUES($1,$2,'unrelated-never-login','Unrelated synthetic fixture','1995-01-01','Kathmandu',true)",
    [unrelated, unrelated + "@example.test"],
  );
  await fixture.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",
    [auth.digest(existingToken), unrelated],
  );
  const before = await fixture.query(
    "SELECT to_jsonb(u) AS record FROM users u WHERE id=$1",
    [unrelated],
  );
  const accounts = await auth.demoAccounts();
  assert.equal(accounts.length, 30);
  assert.deepEqual(
    accounts.map((account) => account.id).sort(),
    [...catalog.demoIds].sort(),
  );
  assert.ok(!accounts.some((account) => account.id === unrelated));
  assert.ok(!accounts.some((account) => account.id === normal));
  await assert.rejects(auth.demoLogin(unrelated), isStatus(403));
  await assert.rejects(auth.demoLogin(normal), isStatus(403));
  const accepted = await auth.demoLogin(id(1));
  assert.equal(await auth.authenticate(`Bearer ${accepted.token}`), id(1));
  assert.equal((await world.initializeDemoWorld()).initialized, false);
  assert.deepEqual(
    (
      await fixture.query(
        "SELECT to_jsonb(u) AS record FROM users u WHERE id=$1",
        [unrelated],
      )
    ).rows,
    before.rows,
  );
  assert.equal(await auth.authenticate(`Bearer ${existingToken}`), unrelated);
  assert.equal(
    (
      await fixture.query(
        "SELECT count(*)::int AS total FROM sessions WHERE user_id=$1",
        [unrelated],
      )
    ).rows[0].total,
    1,
  );
  assert.equal(await normalSnapshot(), normalHash);
});
