import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { resolve } from "node:path";

const base =
  process.env.TEST_DATABASE_URL ||
  "postgres://sangai:local-beta-only@localhost:15432/sangai";
const admin = new Pool({ connectionString: base });
const name = `sangai_games_${randomUUID().replaceAll("-", "")}`;
const connection = new URL(base);
connection.pathname = `/${name}`;
const db = new Pool({ connectionString: connection.toString() });
const port = Number(process.env.GAMES_TEST_PORT || 4106),
  api = `http://127.0.0.1:${port}/v1`;
let server: ChildProcess,
  logs = "";
type Player = { id: string; token: string };
type Pair = { host: Player; guest: Player; stranger: Player };
async function start(enabled = true) {
  logs = "";
  server = spawn(process.execPath, ["dist/main.js"], {
    cwd: resolve("."),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      DATABASE_URL: connection.toString(),
      ENABLE_DEMO: "false",
      ENABLE_PUSH: "false",
      ENABLE_GAMES_V2: String(enabled),
      OTP_HASH_SECRET: randomBytes(32).toString("hex"),
      ADMIN_KEY: "synthetic-games-admin-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (value) => {
    logs += value;
  });
  server.stderr?.on("data", (value) => {
    logs += value;
  });
  server.on("error", (error) => {
    logs += String(error);
  });
  let healthy = false;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) {
        healthy = true;
        break;
      }
    } catch {
      /* Wait for isolated server. */
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok(healthy, logs);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise<void>((done) => server.once("exit", () => done()));
  server.kill();
  await exited;
}
async function player(): Promise<Player> {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO users(id,email,password_hash,name,birth_date,city,demo) VALUES($1,$2,'unused-test-password','Synthetic game player','1990-01-01','Kathmandu',true)",
    [id, `${id}@example.test`],
  );
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [createHash("sha256").update(token).digest("hex"), id],
  );
  return { id, token };
}
async function pair(): Promise<Pair> {
  const host = await player(),
    guest = await player(),
    stranger = await player();
  await db.query(
    "INSERT INTO connections(a,b,sender,state) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1,'matched')",
    [host.id, guest.id],
  );
  return { host, guest, stranger };
}
async function call(path: string, who: Player, body?: unknown) {
  const response = await fetch(api + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${who.token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
async function invite(p: Pair, kind: string) {
  const result = await call(`/games/${p.guest.id}/invite`, p.host, {
    kind,
    clientId: randomUUID(),
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data;
}
async function act(
  who: Player,
  id: string,
  action: string,
  payload: unknown = {},
) {
  const current = await call(`/game/${id}`, who);
  assert.equal(current.status, 200);
  const result = await call(`/game/${id}/action`, who, {
    clientId: randomUUID(),
    expectedRevision: current.data.revision,
    action,
    payload,
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data;
}
async function active(p: Pair, kind: string) {
  const session = await invite(p, kind);
  return act(p.guest, session.id, "accept");
}
before(async () => {
  await admin.query(`CREATE DATABASE ${name}`);
  await start();
});
after(async () => {
  await stop();
  await db.end();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.end();
});

test("seven immutable definitions and async invitation require guest consent, not readiness", async () => {
  const p = await pair(),
    catalog = await call(`/game-catalog?target=${p.guest.id}`, p.host);
  assert.equal(catalog.status, 200);
  assert.equal(catalog.data.games.length, 7);
  assert.equal(catalog.data.recommendedIds.length, 4);
  assert.equal(
    (await call(`/game-catalog?target=${p.stranger.id}`, p.host)).status,
    403,
  );
  const session = await invite(p, "this-or-that");
  assert.equal(session.state, "invited");
  assert.equal(session.version, 2);
  assert.equal(session.definition_version, 1);
  assert.ok(
    Math.abs(Date.parse(session.expires_at) - Date.now() - 86400000) < 5000,
  );
  const premature = await call(`/game/${session.id}/action`, p.host, {
    clientId: randomUUID(),
    expectedRevision: session.revision,
    action: "choice",
    payload: { questionId: "escape", choiceId: "0" },
  });
  assert.equal(premature.status, 409);
  assert.equal(
    (
      await call(`/game/${session.id}/action`, p.host, {
        clientId: randomUUID(),
        expectedRevision: session.revision,
        action: "accept",
        payload: {},
      })
    ).status,
    403,
  );
  assert.equal((await call(`/game/${session.id}`, p.stranger)).status, 404);
  for (const [suffix, payload] of [
    ["respond", { response: "accept" }],
    ["answer", { answers: [0, 0, 0, 0, 0] }],
    ["guess", { guess: 0 }],
  ] as const) {
    assert.equal(
      (await call(`/game/${session.id}/${suffix}`, p.guest, payload)).status,
      409,
    );
  }
  assert.equal(
    (await call(`/game/${session.id}`, p.host)).data.revision,
    session.revision,
  );
  const accepted = await act(p.guest, session.id, "accept");
  assert.equal(accepted.state, "active");
  assert.ok(
    Math.abs(Date.parse(accepted.expires_at) - Date.now() - 7 * 86400000) <
      5000,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM game_readiness WHERE actor=ANY($1::uuid[])",
        [[p.host.id, p.guest.id]],
      )
    ).rows[0].n,
    0,
  );
  const note = (
    await db.query(
      "SELECT * FROM notifications WHERE resource_id=$1 AND recipient=$2",
      [session.id, p.guest.id],
    )
  ).rows[0];
  assert.equal(note.resource_type, "game");
  assert.match(note.body, /invited/);
  await act(p.host, session.id, "cancel");
});

test("This or That, Would You Rather and Compatibility reveal only jointly locked choices", async () => {
  for (const kind of [
    "this-or-that",
    "would-you-rather",
    "compatibility-challenge",
  ]) {
    const p = await pair(),
      session = await active(p, kind);
    for (const q of session.definition.questions)
      await act(p.host, session.id, "choice", {
        questionId: q.id,
        choiceId: "0",
      });
    const guestView = (await call(`/game/${session.id}`, p.guest)).data;
    assert.deepEqual(guestView.view.myChoices, {});
    assert.deepEqual(guestView.view.revealed, []);
    assert.equal(guestView.results, null);
    assert.equal(guestView.state_data, undefined);
    assert.equal(guestView.answers, undefined);
    const exportGuest = (await call("/export", p.guest)).data.games.find(
      (g: any) => g.id === session.id,
    );
    assert.deepEqual(exportGuest.my_choices, {});
    for (const [i, q] of session.definition.questions.entries())
      await act(p.guest, session.id, "choice", {
        questionId: q.id,
        choiceId: i % 2 ? "1" : "0",
      });
    const complete = (await call(`/game/${session.id}`, p.host)).data;
    assert.equal(complete.state, "complete");
    assert.equal(
      complete.results.same,
      Math.ceil(session.definition.questions.length / 2),
    );
    assert.equal(
      complete.results.compared,
      session.definition.questions.length,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM game_results WHERE game_id=$1",
          [session.id],
        )
      ).rows[0].n,
      1,
    );
    const notes = await db.query(
      "SELECT recipient FROM notifications WHERE resource_id=$1 AND body='Your game reveal is ready.'",
      [session.id],
    );
    assert.equal(notes.rowCount, 2);
    assert.equal(
      (
        await call(`/game/${session.id}/action`, p.host, {
          clientId: randomUUID(),
          expectedRevision: complete.revision,
          action: "choice",
          payload: {
            questionId: session.definition.questions[0].id,
            choiceId: "1",
          },
        })
      ).status,
      409,
    );
  }
});

test("Two Truths swaps authors and hides lie indices; own export and reports never disclose partner secrets", async () => {
  const p = await pair(),
    session = await active(p, "two-truths");
  await act(p.host, session.id, "submit-truths", {
    round: 0,
    statements: ["Synthetic one", "Synthetic two", "Synthetic secret three"],
    lie: 2,
  });
  const guestView = (await call(`/game/${session.id}`, p.guest)).data;
  assert.equal(guestView.view.phase, "guess-truths");
  assert.equal(guestView.view.statements.length, 3);
  assert.doesNotMatch(JSON.stringify(guestView), /"lie"\s*:/);
  assert.equal(guestView.view.revealed.length, 0);
  const guestExport = (await call("/export", p.guest)).data.games.find(
    (g: any) => g.id === session.id,
  );
  assert.doesNotMatch(JSON.stringify(guestExport), /Synthetic secret three/);
  const hostExport = (await call("/export", p.host)).data.games.find(
    (g: any) => g.id === session.id,
  );
  assert.equal(hostExport.my_statements[0].lie, 2);
  const report = await call("/reports", p.guest, {
    target: p.host.id,
    gameId: session.id,
    reason: "Synthetic game incident",
    context: "spoofed secret context",
  });
  assert.equal(report.status, 201);
  const context = (
    await db.query("SELECT context FROM reports WHERE id=$1", [report.data.id])
  ).rows[0].context;
  assert.match(context, new RegExp(session.id));
  assert.doesNotMatch(context, /spoofed|Synthetic secret|lie=/);
  assert.equal(
    (
      await call("/reports", p.stranger, {
        target: p.host.id,
        gameId: session.id,
        reason: "Synthetic",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/reports", p.guest, {
        target: p.stranger.id,
        gameId: session.id,
        reason: "Synthetic",
      })
    ).status,
    400,
  );
  await act(p.guest, session.id, "guess", { round: 0, value: 2 });
  const second = (await call(`/game/${session.id}`, p.guest)).data;
  assert.equal(second.view.phase, "write-truths");
  assert.equal(second.view.revealed.length, 1);
  await act(p.guest, session.id, "submit-truths", {
    round: 1,
    statements: ["I paint", "I hike", "I fly"],
    lie: 2,
  });
  const final = await act(p.host, session.id, "guess", { round: 1, value: 0 });
  assert.equal(final.state, "complete");
  assert.equal(final.results.reveals.length, 2);
});

test("Guess My Answer protects the actual answer until each locked guess and enforces alternating turns", async () => {
  const p = await pair(),
    session = await active(p, "guess-my-answer");
  for (let round = 0; round < 6; round++) {
    const author = round % 2 ? p.guest : p.host,
      guesser = round % 2 ? p.host : p.guest;
    await act(author, session.id, "set-answer", { round, choiceId: "2" });
    const hidden = (await call(`/game/${session.id}`, guesser)).data;
    assert.equal(hidden.view.phase, "guess-answer");
    assert.equal(hidden.view.revealed.length, round);
    assert.equal(hidden.state_data, undefined);
    assert.doesNotMatch(JSON.stringify(hidden), /"answer"\s*:/);
    const forbidden = await call(`/game/${session.id}/action`, author, {
      clientId: randomUUID(),
      expectedRevision: hidden.revision,
      action: "guess",
      payload: { round, choiceId: "2" },
    });
    assert.equal(forbidden.status, 403);
    await act(guesser, session.id, "guess", {
      round,
      choiceId: round % 2 ? "1" : "2",
    });
  }
  const final = (await call(`/game/${session.id}`, p.host)).data;
  assert.equal(final.state, "complete");
  assert.equal(final.results.reveals.length, 6);
});

test("Rapid Fire has independent server timers, persists partial play and counts only mutual answers", async () => {
  const p = await pair(),
    session = await active(p, "rapid-fire");
  await act(p.host, session.id, "start-timer");
  await act(p.host, session.id, "choice", {
    questionId: session.definition.questions[0].id,
    choiceId: "0",
  });
  await act(p.host, session.id, "choice", {
    questionId: session.definition.questions[1].id,
    choiceId: "1",
  });
  await db.query(
    "UPDATE games SET state_data=jsonb_set(state_data,ARRAY['timers',$2],to_jsonb((now()-interval '1 second')::text)),next_tick_at=now()-interval '1 second' WHERE id=$1",
    [session.id, p.host.id],
  );
  const timed = (await call(`/game/${session.id}`, p.host)).data;
  assert.equal(timed.view.phase, "waiting");
  assert.equal(timed.view.myChoices[session.definition.questions[0].id], "0");
  await act(p.guest, session.id, "start-timer");
  for (const q of session.definition.questions)
    await act(p.guest, session.id, "choice", {
      questionId: q.id,
      choiceId: "0",
    });
  const final = (await call(`/game/${session.id}`, p.host)).data;
  assert.equal(final.state, "complete");
  assert.equal(final.results.same, 1);
  assert.equal(final.results.compared, 2);
  assert.equal(final.results.heading, "Same choices on 1/2");
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM game_events WHERE game_id=$1 AND type='timer-ended'",
        [session.id],
      )
    ).rows[0].n,
    1,
  );
});

test("20 Questions enforces ask/answer turns and completes twenty real exchanges", async () => {
  const p = await pair(),
    session = await active(p, "20-questions");
  for (let round = 0; round < 20; round++) {
    const asker = round % 2 ? p.guest : p.host,
      respondent = round % 2 ? p.host : p.guest;
    await act(asker, session.id, "ask", {
      round,
      text: `Synthetic question ${round + 1}?`,
    });
    const view = (await call(`/game/${session.id}`, respondent)).data;
    assert.equal(view.view.phase, "respond");
    assert.equal(view.view.prompt, `Synthetic question ${round + 1}?`);
    await act(respondent, session.id, "respond", {
      round,
      text: `Synthetic answer ${round + 1}.`,
    });
  }
  const final = (await call(`/game/${session.id}`, p.host)).data;
  assert.equal(final.state, "complete");
  assert.equal(final.results.reveals.length, 20);
});

test("invite/action retries are idempotent, changed payloads conflict and stale revisions cannot change answers", async () => {
  const p = await pair(),
    payload = { kind: "this-or-that", clientId: randomUUID() };
  const [a, b] = await Promise.all([
    call(`/games/${p.guest.id}/invite`, p.host, payload),
    call(`/games/${p.guest.id}/invite`, p.host, payload),
  ]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.data.id, b.data.id);
  assert.equal(
    (
      await call(`/games/${p.guest.id}/invite`, p.host, {
        ...payload,
        kind: "rapid-fire",
      })
    ).status,
    409,
  );
  const accepted = await act(p.guest, a.data.id, "accept");
  const request = {
    clientId: randomUUID(),
    expectedRevision: accepted.revision,
    action: "choice",
    payload: { questionId: "escape", choiceId: "0" },
  };
  const first = await call(`/game/${a.data.id}/action`, p.host, request),
    replay = await call(`/game/${a.data.id}/action`, p.host, request);
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal(first.data.revision, replay.data.revision);
  assert.equal(
    (
      await call(`/game/${a.data.id}/action`, p.host, {
        ...request,
        payload: { questionId: "escape", choiceId: "1" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`/game/${a.data.id}/action`, p.guest, {
        ...request,
        clientId: randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM game_events WHERE game_id=$1 AND actor=$2 AND client_id=$3",
        [a.data.id, p.host.id, request.clientId],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM notifications WHERE resource_id=$1 AND recipient=$2",
        [a.data.id, p.guest.id],
      )
    ).rows[0].n,
    1,
  );
  await act(p.host, a.data.id, "cancel");
});

test("simultaneous opposing invitations produce one open game; expiry records an event and does not reveal secrets", async () => {
  const p = await pair();
  const [a, b] = await Promise.all([
    call(`/games/${p.guest.id}/invite`, p.host, {
      kind: "this-or-that",
      clientId: randomUUID(),
    }),
    call(`/games/${p.host.id}/invite`, p.guest, {
      kind: "two-truths",
      clientId: randomUUID(),
    }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  const winner = a.status === 201 ? a.data : b.data;
  await db.query(
    "UPDATE games SET expires_at=now()-interval '1 second',next_tick_at=now()-interval '1 second' WHERE id=$1",
    [winner.id],
  );
  const expired = (await call(`/game/${winner.id}`, p.host)).data;
  assert.equal(expired.state, "expired");
  assert.equal(expired.results, null);
  assert.equal(expired.revision, winner.revision + 1);
  await call(`/game/${winner.id}`, p.guest);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM game_events WHERE game_id=$1 AND type='expired'",
        [winner.id],
      )
    ).rows[0].n,
    1,
  );
  const next = await invite(p, "this-or-that");
  await act(p.host, next.id, "cancel");
});

test("block/unmatch revokes game reads and writes while legacy three-game routes still work", async () => {
  const p = await pair(),
    session = await active(p, "two-truths");
  assert.equal((await call(`/block/${p.guest.id}`, p.host, {})).status, 201);
  assert.equal((await call(`/game/${session.id}`, p.guest)).status, 403);
  assert.equal(
    (
      await call(`/game/${session.id}/action`, p.guest, {
        clientId: randomUUID(),
        expectedRevision: session.revision,
        action: "cancel",
        payload: {},
      })
    ).status,
    403,
  );
  const legacy = await pair();
  assert.equal(
    (
      await call(`/games/${legacy.guest.id}`, legacy.host, {
        kind: "this-or-that",
      })
    ).status,
    409,
  );
  await call(`/game-ready/${legacy.guest.id}`, legacy.host, { enabled: true });
  await call(`/game-ready/${legacy.host.id}`, legacy.guest, { enabled: true });
  const invitation = await call(`/games/${legacy.guest.id}`, legacy.host, {
    kind: "this-or-that",
  });
  assert.equal(invitation.status, 201);
  assert.equal(
    (
      await call(`/game/${invitation.data.id}/respond`, legacy.guest, {
        response: "accept",
      })
    ).status,
    201,
  );
  await call(`/game/${invitation.data.id}/answer`, legacy.host, {
    answers: [0, 0, 0, 0, 0],
  });
  const hidden = (
    await call(`/chat/${legacy.host.id}`, legacy.guest)
  ).data.games.find((g: any) => g.id === invitation.data.id);
  assert.deepEqual(hidden.answers, {});
});

test("disabled Games 2.0 blocks new play while preserving authorized reads and cancellation", async () => {
  const prior = await pair(),
    session = await invite(prior, "this-or-that");
  await stop();
  await start(false);
  const p = await pair(),
    catalog = await call(`/game-catalog?target=${p.guest.id}`, p.host);
  assert.equal(catalog.data.enabled, false);
  assert.deepEqual(catalog.data.games, []);
  assert.equal((await call(`/game/${session.id}`, prior.guest)).status, 200);
  assert.equal(
    (
      await call(`/game/${session.id}/action`, prior.guest, {
        action: "accept",
        clientId: randomUUID(),
        expectedRevision: session.revision,
        payload: {},
      })
    ).status,
    404,
  );
  assert.equal(
    (await act(prior.host, session.id, "cancel")).state,
    "cancelled",
  );
  assert.equal(
    (
      await call(`/games/${p.guest.id}/invite`, p.host, {
        kind: "this-or-that",
        clientId: randomUUID(),
      })
    ).status,
    404,
  );
});
