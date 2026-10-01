import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

// An explicitly owned database is the only mutation target. No API instance,
// shared fixtures, real recipients or filesystem media are needed for this suite.
const base =
  process.env.TEST_DATABASE_URL ||
  "postgres://sangai:local-beta-only@localhost:15432/sangai";
const admin = new Pool({ connectionString: base });
const databaseName = "sangai_scalability_" + randomUUID().replaceAll("-", "");
const isolatedUrl = new URL(base);
isolatedUrl.pathname = "/" + databaseName;
const fixtures = new Pool({ connectionString: isolatedUrl.toString() });
let backend: typeof import("../src/db");
let social: typeof import("../src/social");
let moments: typeof import("../src/moments");
let interactions: typeof import("../src/interactions");
let measuring = false;
let queryCount = 0;
let actor: string;
let friend: string;
let stranger: string;

function assertIsolated() {
  assert.match(databaseName, /^sangai_scalability_[a-f0-9]{32}$/);
  assert.equal(new URL(isolatedUrl).pathname, "/" + databaseName);
  assert.notEqual(new URL(base).pathname, "/" + databaseName);
}
async function person(name = "Synthetic tester", demo = false) {
  const id = randomUUID();
  await fixtures.query(
    `INSERT INTO users(id,email,password_hash,name,birth_date,city,demo,email_verified_at,adult_declared_at,onboarded_at,bio)
    VALUES($1,$2,'fixture-never-login',$3,'1995-01-01','Kathmandu',$4,now(),now(),now(),'Synthetic private test profile')`,
    [id, id + "@example.test", name, demo],
  );
  return id;
}
async function match(target: string, state = "matched") {
  await fixtures.query(
    "INSERT INTO connections(a,b,sender,state) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1,$3)",
    [actor, target, state],
  );
}
async function story(author: string, createdAt?: string) {
  const id = randomUUID();
  await fixtures.query(
    "INSERT INTO stories(id,author,body,created_at) VALUES($1,$2,'Synthetic story',COALESCE($3::timestamptz,now()))",
    [id, author, createdAt || null],
  );
  return id;
}
async function post(author = friend) {
  const id = randomUUID();
  await fixtures.query(
    "INSERT INTO posts(id,author,body) VALUES($1,$2,'Synthetic moment')",
    [id, author],
  );
  return id;
}
async function comment(postId: string, author: string, parentId?: string) {
  const id = randomUUID();
  await fixtures.query(
    "INSERT INTO comments(id,post_id,author,body,parent_id) VALUES($1,$2,$3,'Synthetic reply',$4)",
    [id, postId, author, parentId || null],
  );
  return id;
}
async function measured<T>(operation: () => Promise<T>) {
  queryCount = 0;
  measuring = true;
  try {
    const result = await operation();
    return { result, queries: queryCount };
  } finally {
    measuring = false;
  }
}

before(async () => {
  assertIsolated();
  await admin.query(`CREATE DATABASE ${databaseName}`);
  process.env.DATABASE_URL = isolatedUrl.toString();
  backend = await import("../src/db");
  backend.pool.on("connect", (client) => {
    const original = client.query.bind(client) as (...args: any[]) => any;
    client.query = ((...args: any[]) => {
      if (measuring) queryCount++;
      return original(...args);
    }) as typeof client.query;
  });
  await backend.migrate();
  social = await import("../src/social");
  moments = await import("../src/moments");
  interactions = await import("../src/interactions");
});
beforeEach(async () => {
  assertIsolated();
  await fixtures.query("TRUNCATE users CASCADE");
  actor = await person("Synthetic viewer");
  friend = await person("Synthetic match");
  stranger = await person("Synthetic stranger");
  await match(friend);
});
after(async () => {
  measuring = false;
  await backend?.pool.end();
  await fixtures.end();
  assertIsolated();
  await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
  await admin.end();
});

test("more than 200 unrelated newer stories cannot hide an authorized older story", async () => {
  const expected = await story(friend, "2020-01-01T00:00:00Z");
  await fixtures.query(
    "INSERT INTO stories(id,author,body,created_at) SELECT gen_random_uuid(),$1,'Synthetic unrelated story',now() FROM generate_series(1,205)",
    [stranger],
  );
  const result = await social.state(actor);
  assert.deepEqual(
    result.stories.map((s: any) => s.id),
    [expected],
  );
  assert.deepEqual(
    (await social.storiesPage(actor)).items.map((s: any) => s.id),
    [expected],
  );
  assert.equal(typeof result.features.gamesV2, "boolean");
});

test("state reads proceed while an unrelated mutation holds the global advisory lock", async () => {
  const lock = await fixtures.connect();
  let pending: Promise<any> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await lock.query("BEGIN");
    await lock.query("SELECT pg_advisory_xact_lock(20260929)");
    pending = social.state(actor);
    const result = await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () =>
            reject(new Error("Pure state read waited for the mutation lock")),
          1500,
        );
      }),
    ]);
    assert.equal(result.me.id, actor);
  } finally {
    if (deadline) clearTimeout(deadline);
    await lock.query("ROLLBACK");
    lock.release();
    await pending?.catch(() => {});
  }
});

test("read transactions reject writes, release on failure and preserve a repeatable permission snapshot", async () => {
  await assert.rejects(
    backend.readTx((db) =>
      db.query("UPDATE users SET name='Should not write' WHERE id=$1", [actor]),
    ),
    (error: any) => error.code === "25006",
  );
  const settings = await backend.readTx(async (db) => ({
    isolation: (await db.query("SHOW transaction_isolation")).rows[0]
      .transaction_isolation,
    readOnly: (await db.query("SHOW transaction_read_only")).rows[0]
      .transaction_read_only,
  }));
  assert.deepEqual(settings, { isolation: "repeatable read", readOnly: "on" });
  await backend.readTx(async (db) => {
    assert.equal(
      (await db.query("SELECT posts_visible FROM users WHERE id=$1", [friend]))
        .rows[0].posts_visible,
      true,
    );
    await fixtures.query("UPDATE users SET posts_visible=false WHERE id=$1", [
      friend,
    ]);
    assert.equal(
      (await db.query("SELECT posts_visible FROM users WHERE id=$1", [friend]))
        .rows[0].posts_visible,
      true,
    );
  });
  assert.equal((await social.state(actor)).matches[0].name, "Synthetic match");
  assert.equal(
    (await fixtures.query("SELECT name FROM users WHERE id=$1", [actor]))
      .rows[0].name,
    "Synthetic viewer",
  );
});

test("batched projections retain ready-account, demo, block, suspension and audience boundaries", async () => {
  const blocked = await person("Synthetic blocked"),
    suspended = await person("Synthetic suspended"),
    crossDemo = await person("Synthetic demo", true),
    unready = await person("Synthetic incomplete"),
    ended = await person("Synthetic ended");
  for (const id of [blocked, suspended, crossDemo, unready]) await match(id);
  await match(ended, "ended");
  await fixtures.query("INSERT INTO blocks(actor,target) VALUES($1,$2)", [
    blocked,
    actor,
  ]);
  await fixtures.query("UPDATE users SET suspended=true WHERE id=$1", [
    suspended,
  ]);
  await fixtures.query("UPDATE users SET email_verified_at=NULL WHERE id=$1", [
    unready,
  ]);
  for (const id of [
    actor,
    friend,
    stranger,
    blocked,
    suspended,
    crossDemo,
    unready,
    ended,
  ]) {
    await story(id);
    await post(id);
  }
  const result = await social.state(actor);
  assert.deepEqual(
    result.matches.map((p: any) => p.id),
    [friend],
  );
  assert.deepEqual(
    new Set(result.stories.map((s: any) => s.author.id)),
    new Set([actor, friend]),
  );
  assert.deepEqual(
    new Set(result.feed.map((p: any) => p.author.id)),
    new Set([actor, friend]),
  );
  for (const p of [
    ...result.matches,
    ...result.stories.map((s: any) => s.author),
  ]) {
    assert.equal("email" in p, false);
    assert.equal("birth_date" in p, false);
  }
  await fixtures.query(
    "UPDATE users SET stories_visible=false,posts_visible=false WHERE id=$1",
    [friend],
  );
  const hidden = await social.state(actor);
  assert.deepEqual(
    hidden.stories.map((s: any) => s.author.id),
    [actor],
  );
  assert.deepEqual(
    hidden.feed.map((p: any) => p.author.id),
    [actor],
  );
  await fixtures.query(
    "UPDATE connections SET state='ended' WHERE a=LEAST($1::uuid,$2::uuid) AND b=GREATEST($1::uuid,$2::uuid)",
    [actor, friend],
  );
  assert.equal((await social.matchesPage(actor)).items.length, 0);
});

test("post batches aggregate only visible reactions and hide replies beneath invisible ancestors", async () => {
  const id = await post();
  const root = await comment(id, friend);
  const reply = await comment(id, actor, root);
  const hidden = await comment(id, stranger);
  const orphan = await comment(id, friend, hidden);
  const grandchild = await comment(id, actor, orphan);
  await fixtures.query(
    "INSERT INTO reactions(post_id,actor) VALUES($1,$2),($1,$3),($1,$4)",
    [id, actor, friend, stranger],
  );
  await fixtures.query("INSERT INTO saved_posts(actor,post_id) VALUES($1,$2)", [
    actor,
    id,
  ]);
  const attachments = [randomUUID(), randomUUID()];
  for (const mediaId of attachments)
    await fixtures.query(
      "INSERT INTO media(id,owner,kind,path,mime) VALUES($1,$2,'image','unused-isolated-fixture','image/jpeg')",
      [mediaId, friend],
    );
  await fixtures.query(
    "INSERT INTO post_media(post_id,media_id,position) VALUES($1,$2,1),($1,$3,0)",
    [id, ...attachments],
  );
  const result = await backend.readTx((db) =>
    moments.postDetail(db, actor, id),
  );
  assert.deepEqual(
    new Set(result.comments.map((c: any) => c.id)),
    new Set([root, reply]),
  );
  assert.ok(
    !result.comments.some((c: any) =>
      [hidden, orphan, grandchild].includes(c.id),
    ),
  );
  assert.equal(result.likes, 2);
  assert.equal(result.liked, true);
  assert.equal(result.saved, true);
  assert.deepEqual(
    result.media.map((m: any) => m.id),
    attachments.toReversed(),
  );
  await fixtures.query("INSERT INTO blocks(actor,target) VALUES($1,$2)", [
    actor,
    friend,
  ]);
  await assert.rejects(
    backend.readTx((db) => moments.postDetail(db, actor, id)),
    /Post unavailable/,
  );
  assert.equal((await moments.saved(actor)).length, 0);
});

test("unrelated comments are filtered before the per-post preview limit", async () => {
  const id = await post();
  const visible = await comment(id, friend);
  await fixtures.query(
    "UPDATE comments SET created_at='2020-01-01' WHERE id=$1",
    [visible],
  );
  await fixtures.query(
    "INSERT INTO comments(id,post_id,author,body) SELECT gen_random_uuid(),$1,$2,'Synthetic unrelated reply' FROM generate_series(1,60)",
    [id, stranger],
  );
  const result = await backend.readTx((db) =>
    moments.postDetail(db, actor, id),
  );
  assert.deepEqual(
    result.comments.map((c: any) => c.id),
    [visible],
  );
});

test("state query count stays constant as matches, posts, visible commenters and reactors grow", async () => {
  const first = await post();
  await story(friend);
  await comment(first, friend);
  await fixtures.query("INSERT INTO reactions(post_id,actor) VALUES($1,$2)", [
    first,
    friend,
  ]);
  const small = await measured(() => social.state(actor));
  for (let i = 0; i < 40; i++) {
    const id = await person("Synthetic match " + String(i).padStart(2, "0"));
    await match(id);
    await comment(first, id);
    await fixtures.query("INSERT INTO reactions(post_id,actor) VALUES($1,$2)", [
      first,
      id,
    ]);
    await fixtures.query(
      "INSERT INTO messages(id,sender,recipient,body,client_id) VALUES($1,$2,$3,'Synthetic unread',$4)",
      [randomUUID(), id, actor, randomUUID()],
    );
  }
  for (let i = 0; i < 29; i++) await post();
  const large = await measured(() => social.state(actor));
  assert.equal(large.result.matches.length, 30);
  const remaining = await social.matchesPage(
    actor,
    large.result.matchesNextCursor.afterName,
    large.result.matchesNextCursor.afterId,
  );
  assert.equal(remaining.items.length, 11);
  assert.equal(
    new Set([...large.result.matches, ...remaining.items].map((p) => p.id))
      .size,
    41,
  );
  assert.equal(large.result.feed.length, 30);
  assert.equal(large.result.feed.find((p: any) => p.id === first).likes, 41);
  assert.equal(large.queries, small.queries);
  assert.ok(
    large.queries <= 20,
    `State query budget exceeded: ${large.queries}`,
  );
  console.info(
    `Measured state client.query calls: small=${small.queries}, larger=${large.queries}; this is a query-count regression, not a capacity test.`,
  );
});

test("batched unread and latest-message summaries keep existing public presentation", async () => {
  await fixtures.query(
    "INSERT INTO messages(id,sender,recipient,body,client_id,created_at,read_at) VALUES($1,$2,$3,'Older incoming',$4,'2020-01-01',NULL),($5,$2,$3,'Read incoming',$6,'2020-01-02',now()),($7,$3,$2,'Latest outgoing',$8,'2020-01-03',NULL)",
    [
      randomUUID(),
      friend,
      actor,
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ],
  );
  const result = await social.matchesPage(actor);
  assert.equal(result.items[0].unread, 1);
  assert.equal(result.items[0].preview, "Latest outgoing");
});

test("story and notification cursors preserve microsecond timestamp ties without gaps", async () => {
  const timestamp = "2020-01-01T12:00:00.123456Z";
  const storyIds: string[] = [];
  const notificationIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    storyIds.push(await story(friend, timestamp));
    const id = randomUUID();
    notificationIds.push(id);
    await fixtures.query(
      "INSERT INTO notifications(id,recipient,actor,kind,body,created_at,resource_type,resource_id) VALUES($1,$2,$3,'game','Synthetic invitation',$4,'game',$5)",
      [id, actor, friend, timestamp, randomUUID()],
    );
  }
  for (const [fetchPage, expected] of [
    [social.storiesPage, storyIds],
    [social.notificationsPage, notificationIds],
  ] as const) {
    const seen: string[] = [];
    let before: string | undefined;
    let beforeId: string | undefined;
    for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
      const result = await fetchPage(actor, before, beforeId, 2);
      assert.ok(result.items.length <= 2);
      for (const item of result.items) {
        assert.equal("cursor_created_at" in item, false);
        seen.push(item.id);
      }
      if (!result.hasMore) {
        assert.equal(result.nextCursor, null);
        break;
      }
      assert.equal(result.nextCursor?.before, timestamp);
      before = result.nextCursor!.before;
      beforeId = result.nextCursor!.beforeId;
    }
    assert.deepEqual(seen, expected.toSorted().toReversed());
    assert.equal(new Set(seen).size, expected.length);
  }
  const notification = (await social.notificationsPage(actor)).items[0];
  assert.equal(notification.resource_type, "game");
  assert.ok(notification.resource_id);
});

test("feed cursors preserve microseconds across pages without losing same-millisecond posts", async () => {
  for (let i = 0; i < 65; i++) {
    await fixtures.query(
      "INSERT INTO posts(id,author,body,created_at) VALUES($1,$2,'Synthetic precision fixture',$3)",
      [randomUUID(), friend, `2020-01-01T12:00:00.12345${i % 10}Z`],
    );
  }
  const expected = (
    await fixtures.query(
      "SELECT id FROM posts ORDER BY created_at DESC,id DESC",
    )
  ).rows.map((p) => p.id);
  const seen: string[] = [];
  let before: string | undefined, beforeId: string | undefined;
  for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
    const page = await backend.readTx((db) =>
      social.feed(db, actor, before, beforeId),
    );
    for (const item of page) {
      assert.match(item.created_at, /^2020-01-01T12:00:00\.12345\dZ$/);
      seen.push(item.id);
    }
    if (page.length < 30) break;
    before = page.at(-1)!.created_at;
    beforeId = page.at(-1)!.id;
  }
  assert.deepEqual(seen, expected);
  assert.equal(new Set(seen).size, 65);
  const detail = await backend.readTx((db) =>
    moments.postDetail(db, actor, expected[0]),
  );
  assert.match(detail.created_at, /^2020-01-01T12:00:00\.12345\dZ$/);
});

test("mixed conversation hydration preserves exact cursor timestamps across history pages", async () => {
  const mediaId = randomUUID();
  await fixtures.query(
    "INSERT INTO media(id,owner,kind,path,mime,purpose) VALUES($1,$2,'image','synthetic-never-read','image/jpeg',$3)",
    [mediaId, friend, "snap:" + actor],
  );
  for (let i = 0; i < 70; i++) {
    const id = randomUUID(),
      created = `2020-01-01T12:00:00.12345${i % 10}Z`;
    if (i % 4 === 0)
      await fixtures.query(
        "INSERT INTO messages(id,sender,recipient,body,client_id,created_at) VALUES($1,$2,$3,'Synthetic precision message',$5,$4)",
        [id, friend, actor, created, "precision-" + i],
      );
    else if (i % 4 === 1)
      await fixtures.query(
        "INSERT INTO snaps(id,sender,recipient,media_id,created_at) VALUES($1,$2,$3,$4,$5)",
        [id, friend, actor, mediaId, created],
      );
    else if (i % 4 === 2)
      await fixtures.query(
        "INSERT INTO games(id,host,guest,kind,created_at) VALUES($1,$2,$3,'this-or-that',$4)",
        [id, friend, actor, created],
      );
    else
      await fixtures.query(
        "INSERT INTO plans(id,host,guest,title,venue,scheduled_at,created_at) VALUES($1,$2,$3,'Synthetic precision plan','Synthetic venue',now()+interval '1 day',$4)",
        [id, friend, actor, created],
      );
  }
  const expected = (
    await fixtures.query(
      "SELECT id FROM (SELECT id,created_at FROM messages UNION ALL SELECT id,created_at FROM snaps UNION ALL SELECT id,created_at FROM games UNION ALL SELECT id,created_at FROM plans) timeline ORDER BY created_at DESC,id DESC",
    )
  ).rows.map((item) => item.id);
  const seen: string[] = [];
  let before: string | undefined, beforeId: string | undefined;
  for (let pageNumber = 0; pageNumber < 3; pageNumber++) {
    const page = await interactions.conversation(
      actor,
      friend,
      before,
      beforeId,
    );
    assert.ok(page.timeline.length <= 50);
    for (const item of page.timeline.toReversed()) {
      assert.match(item.created_at, /^2020-01-01T12:00:00\.12345\dZ$/);
      assert.equal("cursor_created_at" in item, false);
      seen.push(item.id);
    }
    if (!page.hasMore) break;
    before = page.timeline[0].created_at;
    beforeId = page.timeline[0].id;
  }
  assert.deepEqual(seen, expected);
  assert.equal(new Set(seen).size, 70);
});

test("match pages retain duplicate-name ties and bounded summaries", async () => {
  const expected = [friend];
  for (let i = 0; i < 5; i++) {
    const id = await person("Same synthetic name");
    expected.push(id);
    await match(id);
  }
  const seen: string[] = [];
  let afterName: string | undefined;
  let afterId: string | undefined;
  for (let pageNumber = 0; pageNumber < 5; pageNumber++) {
    const page = await social.matchesPage(actor, afterName, afterId, 2);
    seen.push(...page.items.map((p: any) => p.id));
    assert.ok(page.items.length <= 2);
    if (!page.hasMore) break;
    afterName = page.nextCursor!.afterName;
    afterId = page.nextCursor!.afterId;
  }
  const ordered = (
    await fixtures.query(
      "SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY name,id",
      [expected],
    )
  ).rows.map((r: any) => r.id);
  assert.deepEqual(seen, ordered);
});

test("page helpers reject partial cursors and oversized or invalid limits", async () => {
  await assert.rejects(social.matchesPage(actor, "Name"), /both cursor/);
  await assert.rejects(
    social.storiesPage(actor, "2020-01-01T00:00:00Z"),
    /both cursor/,
  );
  await assert.rejects(
    social.notificationsPage(actor, undefined, randomUUID()),
    /both cursor/,
  );
  for (const limit of [0, 51, 1.5, NaN]) {
    await assert.rejects(
      social.matchesPage(actor, undefined, undefined, limit),
    );
    await assert.rejects(
      social.storiesPage(actor, undefined, undefined, limit),
    );
    await assert.rejects(
      social.notificationsPage(actor, undefined, undefined, limit),
    );
  }
});
