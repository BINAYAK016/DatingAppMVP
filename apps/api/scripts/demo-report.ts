import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  demoPersonas,
  demoEligibility,
  expectedDemoCandidates,
  id,
} from "../src/demoPersonas";

// This is an explicitly invoked local demo exercise, never a startup job.
// Credentials remain in memory; reports contain synthetic public fields only.
async function main() {
  const base = process.env.DEMO_REPORT_URL || "http://127.0.0.1:4100";
  assert.ok(
    process.argv.includes("--reset"),
    "Pass --reset to confirm restoring the shared demo world before and after this exercise.",
  );
  const address = new URL(base);
  assert.ok(
    ["127.0.0.1", "localhost"].includes(address.hostname),
    "This script is restricted to the local beta.",
  );
  const tokens = new Map<string, string>();
  async function call(path: string, actor?: string, body?: unknown) {
    const response = await fetch(base + "/v1" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(actor ? { Authorization: "Bearer " + tokens.get(actor) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    assert.ok(response.ok, `${path}: ${response.status} ${data.message || ""}`);
    return data;
  }
  async function enter(actor: string) {
    const session = await call("/auth/demo", undefined, { id: actor });
    assert.equal(session.user.id, actor);
    tokens.set(actor, session.token);
  }
  async function discovery(actor: string) {
    const items: any[] = [],
      pages: number[] = [];
    let cursor: string | null = null;
    do {
      const page = await call(
        `/discovery?limit=3${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
        actor,
      );
      assert.ok(page.items.length <= 3);
      assert.ok(
        !page.nextCursor || page.nextCursor !== cursor,
        "Cursor must advance.",
      );
      pages.push(page.items.length);
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(new Set(items.map((p) => p.id)).size, items.length);
    return { items, pages };
  }
  const config = await call("/demo/config");
  assert.equal(config.enabled, true);
  assert.deepEqual(config.groups, { men: 10, women: 10, lgbtq: 10 });
  await enter(id(1));
  const baseline = await call("/demo/reset", id(1), { confirm: true });
  // Seed declarations are independent of the SQL engine; compare exact identities,
  // not merely counts. An inconsistency throws before any journey mutation.
  const { demoScenarioContext, demoInventory } =
    await import("../src/demoWorld");
  const matrix: any[] = [],
    journeys: any[] = [];
  try {
    for (const persona of demoPersonas) {
      await enter(persona.id);
      const actual = await discovery(persona.id);
      const expected = expectedDemoCandidates(persona, {
        ...demoScenarioContext,
        at: new Date().toISOString().slice(0, 10),
      });
      assert.deepEqual(
        actual.items.map((p) => p.id).sort(),
        [...expected].sort(),
        `${persona.profile.name} discovery differs from independent reciprocal preference oracle.`,
      );
      const filtered = demoPersonas
        .filter((p) => !expected.includes(p.id))
        .map((target) => ({
          name: target.profile.name,
          reasons: demoEligibility(persona, target, {
            ...demoScenarioContext,
            at: new Date().toISOString().slice(0, 10),
          }).reasons,
        }));
      matrix.push({
        name: persona.profile.name,
        group: persona.selectorGroup,
        gender: persona.profile.gender,
        orientation: persona.orientation,
        lookingFor: persona.profile.preferences.genders,
        expected: expected.length,
        actual: actual.items.length,
        pages: actual.pages,
        eligible: actual.items.map((p) => p.name),
        filtered,
        result: "PASS",
      });
      const own = await call("/profiles/" + persona.id, persona.id);
      assert.ok(
        own.bio &&
          own.prompt &&
          own.profession &&
          own.education &&
          own.media.length,
        "Complete actual profile required.",
      );
      const image = await fetch(base + "/v1/media/" + own.avatar_id, {
        headers: { Authorization: "Bearer " + tokens.get(persona.id) },
      });
      assert.ok(image.ok, "Actual private profile image must load.");
      await image.body?.cancel();
    }
    journeys.push({
      test: 1,
      action:
        "Enter Aarav; exact reciprocal discovery and incompatibility exclusions",
      result: "PASS",
      profiles: matrix[0].eligible,
    });
    const like = await call("/discovery/" + id(27), id(1), {
      action: "like",
      clientId: randomUUID(),
    });
    assert.equal(like.matched, false);
    journeys.push({
      test: 2,
      action: "Aarav Likes Tavi; no match yet",
      result: "PASS",
    });
    await enter(id(27));
    const mutual = await call("/discovery/" + id(1), id(27), {
      action: "like",
      clientId: randomUUID(),
    });
    assert.equal(mutual.matched, true);
    journeys.push({
      test: 3,
      action: "Switch to Tavi; Like Aarav; real mutual match",
      result: "PASS",
    });
    for (const [actor, target, body] of [
      [
        id(1),
        id(27),
        "Hi Tavi! Which fictional weekend adventure would you pick?",
      ],
      [
        id(27),
        id(1),
        "A slow coffee and a sketchbook walk. Want to try a game?",
      ],
    ] as const) {
      await call("/chat/" + target, actor, { body, clientId: randomUUID() });
    }
    assert.ok(
      (await call("/chat/" + id(1), id(27))).timeline.some(
        (entry: any) => entry.type === "message",
      ),
    );
    journeys.push({
      test: 4,
      action: "Both matched users send/read actual chat messages",
      result: "PASS",
    });
    for (const [offset, kind] of [
      "this-or-that",
      "would-you-rather",
      "two-truths",
      "rapid-fire",
    ].entries()) {
      let game = await call("/games/" + id(27) + "/invite", id(1), {
        kind,
        clientId: randomUUID(),
      });
      assert.equal(game.state, "invited");
      async function act(actor: string, action: string, payload: unknown = {}) {
        const current = await call("/game/" + game.id, actor);
        game = await call("/game/" + game.id + "/action", actor, {
          action,
          payload,
          clientId: randomUUID(),
          expectedRevision: current.revision,
        });
      }
      await act(id(27), "accept");
      assert.equal(game.state, "active");
      if (kind === "two-truths") {
        for (const [round, author] of [id(1), id(27)].entries()) {
          await act(author, "submit-truths", {
            round,
            statements: [
              "I collect fictional café sketches.",
              "I can name three imaginary mountain trails.",
              "I have a pet dragon.",
            ],
            lie: 2,
          });
          await act(author === id(1) ? id(27) : id(1), "guess", {
            round,
            value: 2,
          });
        }
      } else {
        for (const actor of [id(1), id(27)]) {
          if (kind === "rapid-fire") await act(actor, "start-timer");
          for (const question of game.definition.questions)
            await act(actor, "choice", {
              questionId: question.id,
              choiceId: question.options[0].id,
            });
        }
      }
      const result = await call("/game/" + game.id, id(1));
      assert.equal(result.state, "complete");
      assert.ok(result.results);
      assert.ok(
        (await call("/chat/" + id(27), id(1))).timeline.some(
          (entry: any) => entry.type === "game" && entry.id === game.id,
        ),
      );
      journeys.push({
        test: offset + 5,
        action: `${result.definition.title}: invite, accept, both play, result, actual Chat timeline`,
        result: "PASS",
      });
    }
    const plan = await call("/plans/" + id(27), id(1), {
      title: "Coffee · fictional demo plan",
      venue: "Imaginary café · Kathmandu",
      scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    });
    await call("/plan/" + plan.id, id(27), { state: "accepted" });
    assert.ok(
      (await call("/chat/" + id(27), id(1))).timeline.some(
        (entry: any) => entry.id === plan.id && entry.state === "accepted",
      ),
    );
    journeys.push({
      test: 9,
      action:
        "Propose and accept a demo coffee date through the actual planner",
      result: "PASS",
    });
    const first = await call("/feed", id(1)),
      tail = first.at(-1);
    assert.equal(first.length, 30);
    const second = await call(
      `/feed?before=${encodeURIComponent(tail.created_at)}&beforeId=${tail.id}`,
      id(1),
    );
    assert.ok(second.length > 0);
    assert.ok(
      !second.some((post: any) =>
        first.some((head: any) => head.id === post.id),
      ),
    );
    const other = first.find((post: any) => post.author.id !== id(1));
    await call("/profiles/" + other.author.id, id(1));
    await call("/posts/" + other.id + "/react", id(1), {});
    await call("/posts/" + other.id + "/comments", id(1), {
      body: "A fictional beta comment: this looks like a lovely sketch walk.",
    });
    await call("/chat/" + id(27), id(1));
    const stories = await call("/stories?limit=3", id(1));
    assert.ok(
      stories.items.every(
        (story: any) => new Date(story.expires_at).getTime() > Date.now(),
      ),
    );
    journeys.push({
      test: 10,
      action:
        "Sangai pagination, reaction, comment, actual profile, Chat and active-only story list",
      result: "PASS",
      feedPages: [first.length, second.length],
    });
    for (const [number, indices, gender] of [
      [11, [21, 22], "Man"],
      [12, [23, 24], "Woman"],
      [13, [25, 27, 28, 29], undefined],
    ] as const) {
      for (const index of indices) {
        const entry = matrix[index - 1];
        assert.ok(entry.actual > 0);
        if (gender)
          assert.ok(
            entry.eligible.every(
              (name: string) =>
                demoPersonas.find((p) => p.profile.name === name)?.profile
                  .gender === gender,
            ),
          );
      }
      journeys.push({
        test: number,
        action:
          number === 11
            ? "Gay men discover reciprocal male prospects"
            : number === 12
              ? "Lesbian women discover reciprocal female prospects"
              : "Bi/pan and non-binary discovery respects explicit reciprocal preferences",
        result: "PASS",
      });
    }
  } finally {
    await call("/demo/reset", id(1), { confirm: true });
  }
  const report = {
    recordedAt: new Date().toISOString(),
    scope:
      "Actual local HTTP/API journey; separate native/browser evidence required for animations and controls",
    baseline,
    inventory: demoInventory,
    discovery: matrix,
    journeys,
    baselineRestored: true,
  };
  const destination = resolve("../../docs");
  await mkdir(destination, { recursive: true });
  await writeFile(
    resolve(destination, "demo-test-results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      profiles: matrix.length,
      journeys: journeys.length,
      result: "PASS",
      baselineRestored: true,
    }),
  );
  // demoWorld imports the database pool for its shared declarations. Release it
  // without ever querying through the report script's independent oracle.
  const { pool } = await import("../src/db");
  await pool.end();
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
