import { expect, test, type Page } from "@playwright/test";
import type { Person, State, Story } from "../../apps/mobile/src/lib/types";

// These larger synthetic pages exercise the shared store, not the thirty-person
// demo manifest. Every application endpoint is mocked; no account/reset is sent
// to the real service and no external media is used.
function person(index: number): Person {
  return {
    id: `91000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name: `Synthetic Connection ${String(index).padStart(2, "0")}`,
    age: 28,
    city: "Kathmandu",
    bio: "Synthetic pagination fixture.",
    intent: "Serious relationship",
    interests: ["Art"],
    prompt: "An invented conversation starter.",
    gender: "Woman",
    color: "#F7E6E9",
    demo: false,
    languages: ["Nepali"],
    hobbies: [],
    profession: "",
    education: "",
    lifestyle: {},
    preview: "A synthetic short conversation.",
  };
}
const matches = Array.from({ length: 32 }, (_, index) => person(index + 1));
const matchesCursor = {
  afterName: matches[29].name,
  afterId: matches[29].id,
};
const storiesCursor = {
  before: "2026-10-02T08:00:00.123456Z",
  beforeId: "92000000-0000-4000-8000-000000000030",
};
function story(index: number, author = matches[0]): Story {
  return {
    id: `92000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    author,
    body: `Synthetic story ${index}`,
    expires_at: "2099-01-01T00:00:00Z",
  };
}
const stories = Array.from({ length: 30 }, (_, index) => story(index + 1));
function state(revoked = false): State {
  return {
    me: {
      ...person(0),
      email: "pagination@example.test",
      email_verified_at: "2026-10-02T08:00:00Z",
      adult_declared_at: "2026-10-02T08:00:00Z",
      onboarded_at: "2026-10-02T08:00:00Z",
      onboarding_step: 5,
      birth_date: "1998-04-01",
      paused: false,
      notifications: false,
      posts_visible: true,
      stories_visible: true,
      messages_enabled: true,
      interactions_enabled: true,
      data_saver: false,
      preferences: { cities: [], genders: [], minAge: 21, maxAge: 35 },
    },
    features: { gamesV2: true },
    matches: revoked ? [matches[0]] : matches.slice(0, 30),
    matchesNextCursor: revoked ? null : matchesCursor,
    stories: revoked ? [] : stories,
    storiesNextCursor: revoked ? null : storiesCursor,
    discover: [],
    undoId: null,
    feed: [],
    notifications: [],
    games: [],
  };
}
async function fixture(page: Page, delayed?: "matches" | "stories") {
  let revoked = false,
    stateReads = 0,
    released = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queries: { kind: string; query: URLSearchParams }[] = [],
    unexpected: string[] = [];
  await page.route("**/v1/**", async (route) => {
    if (new URL(route.request().url()).pathname === "/v1/auth/session")
      return route.fulfill({
        status: 401,
        json: { message: "Please sign in." },
      });
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.slice(3);
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ status, json });
    if (request.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      });
    if (path === "/demo/config")
      return reply({
        enabled: false,
        version: 1,
        groups: { men: 10, women: 10, lgbtq: 10 },
      });
    if (path === "/auth/config")
      return reply({ google: false, localMail: true, otpConfigured: true });
    if (path === "/auth/login")
      return reply({ csrfToken: "synthetic-pagination-session" });
    if (path === "/state") {
      stateReads++;
      return reply(state(revoked));
    }
    if (path === "/matches" || path === "/stories") {
      const kind = path.slice(1);
      queries.push({ kind, query: url.searchParams });
      expect(url.searchParams.get("limit")).toBe("30");
      if (kind === "matches") {
        expect(url.searchParams.get("afterName")).toBe(matchesCursor.afterName);
        expect(url.searchParams.get("afterId")).toBe(matchesCursor.afterId);
      } else {
        expect(url.searchParams.get("before")).toBe(storiesCursor.before);
        expect(url.searchParams.get("beforeId")).toBe(storiesCursor.beforeId);
      }
      if (delayed === kind && !released) await gate;
      // An older in-flight response deliberately retains the now-revoked person.
      return reply(
        kind === "matches"
          ? {
              items: [
                { ...matches[29], preview: "Updated overlapping conversation" },
                matches[30],
                matches[31],
              ],
              nextCursor: null,
            }
          : {
              items: [
                { ...stories[29], body: "Updated overlapping story" },
                story(31, matches[1]),
                story(32, matches[1]),
              ],
              nextCursor: null,
            },
      );
    }
    unexpected.push(`${request.method()} ${path}`);
    return reply({ message: "Unexpected synthetic fixture endpoint" }, 404);
  });
  return {
    queries,
    unexpected,
    get reads() {
      return stateReads;
    },
    revoke() {
      revoked = true;
    },
    release() {
      released = true;
      release();
    },
  };
}
async function openChat(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "I already have an account", exact: true })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill("pagination@example.test");
  await page
    .getByLabel("Password · at least 10 characters", { exact: true })
    .fill("synthetic-pagination-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("tab", { name: "Chat", exact: false }).click();
  await expect(
    page.getByRole("button", {
      name: `Chat with ${matches[0].name}`,
      exact: true,
    }),
  ).toBeVisible();
}
async function loadMatches(page: Page, count: () => number) {
  await page.mouse.move(220, 500);
  await expect
    .poll(async () => {
      await page.mouse.wheel(0, 1800);
      return count();
    })
    .toBeGreaterThan(0);
}

test("match and story load-more uses bounded exact cursors and keeps terminal pages deduplicated", async ({
  page,
}) => {
  const data = await fixture(page);
  await openChat(page);
  await loadMatches(
    page,
    () => data.queries.filter((q) => q.kind === "matches").length,
  );
  await expect(
    page.getByRole("button", {
      name: `Chat with ${matches[31].name}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: `Chat with ${matches[29].name}`,
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByText("Updated overlapping conversation", { exact: true }),
  ).toHaveCount(1);
  await page.mouse.wheel(0, -5000);
  await page.getByRole("button", { name: "More stories", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: `View ${matches[1].name}'s story`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: `View ${matches[0].name}'s story`,
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "More stories", exact: true }),
  ).toHaveCount(0);
  await page.mouse.move(220, 500);
  await page.mouse.wheel(0, 5000);
  await expect(
    page.getByRole("button", {
      name: `Chat with ${matches[31].name}`,
      exact: true,
    }),
  ).toBeVisible();
  expect(data.queries.filter((q) => q.kind === "matches")).toHaveLength(1);
  expect(data.queries.filter((q) => q.kind === "stories")).toHaveLength(1);
  expect(data.unexpected).toEqual([]);
});

for (const kind of ["matches", "stories"] as const) {
  test(`a delayed ${kind} page cannot resurrect access revoked by a newer bootstrap`, async ({
    page,
  }) => {
    await page.clock.install();
    const data = await fixture(page, kind);
    await openChat(page);
    try {
      if (kind === "matches")
        await loadMatches(
          page,
          () => data.queries.filter((q) => q.kind === kind).length,
        );
      else
        await page
          .getByRole("button", { name: "More stories", exact: true })
          .click();
      await expect
        .poll(() => data.queries.filter((q) => q.kind === kind).length)
        .toBe(1);
      const reads = data.reads;
      data.revoke();
      // Exercise the existing periodic bootstrap while the old page remains in
      // flight, advancing its clock instead of waiting twelve real seconds.
      await page.clock.fastForward(12050);
      await expect.poll(() => data.reads).toBeGreaterThan(reads);
      await expect(
        page.getByRole("button", {
          name: `Chat with ${matches[0].name}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "More stories", exact: true }),
      ).toHaveCount(0);
      const newerReads = data.reads,
        denied = kind === "matches" ? matches[30].name : matches[1].name;
      await page.evaluate((name) => {
        const record = window as typeof window & { staleLabels?: string[] };
        record.staleLabels = [];
        new MutationObserver((changes) => {
          for (const change of changes)
            for (const node of change.addedNodes)
              if (node.textContent?.includes(name))
                record.staleLabels!.push(name);
        }).observe(document.body, { childList: true, subtree: true });
      }, denied);
      data.release();
      // The source must discard/reproject the late page through the current
      // bootstrap; merely removing it on the following heartbeat is unsafe.
      await expect.poll(() => data.reads).toBeGreaterThan(newerReads);
      await expect(
        page.getByRole("button", { name: `Chat with ${denied}`, exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: `View ${denied}'s story`,
          exact: true,
        }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            (window as typeof window & { staleLabels?: string[] }).staleLabels,
        ),
      ).toEqual([]);
      expect(data.unexpected).toEqual([]);
    } finally {
      data.release();
    }
  });
}
