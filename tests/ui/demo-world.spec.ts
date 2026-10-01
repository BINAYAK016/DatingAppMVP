import { expect, test, type Page } from "@playwright/test";
import type { DemoGroup, DemoPerson } from "../../apps/mobile/src/lib/demo";

const groups: DemoGroup[] = ["men", "women", "lgbtq"];
function demoPerson(group: DemoGroup, index: number): DemoPerson {
  const prefix = { men: "81", women: "82", lgbtq: "83" }[group];
  const noun = { men: "Man", women: "Woman", lgbtq: "Person" }[group];
  return {
    id: `${prefix}000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: `Fictional ${noun} ${index + 1}`,
    age: 21 + index,
    city: "Kathmandu",
    bio: `Synthetic baseline profile for ${noun.toLowerCase()} ${index + 1}. Coffee, books and a weekend walk.`,
    intent: ["Serious relationship", "Marriage", "Casual dating"][index % 3],
    gender:
      group === "men" ? "Man" : group === "women" ? "Woman" : "Non-binary",
    interests: ["Coffee", "Reading"],
    prompt: "Ask me about a fictional favourite book.",
    color: "#F7E6E9",
    demo: true,
    languages: ["Nepali", "English"],
    hobbies: ["Reading"],
    profession: "Synthetic designer",
    education: "Demo graduate",
    lifestyle: { smoking: "Never" },
    demo_group: group,
    orientation: group === "lgbtq" ? "Pansexual" : "Straight",
    pronouns:
      group === "men" ? "he/him" : group === "women" ? "she/her" : "they/them",
    looking_for:
      group === "men"
        ? ["Women"]
        : group === "women"
          ? ["Men"]
          : ["Men", "Women", "Non-binary people"],
  };
}
const people = Object.fromEntries(
  groups.map((group) => [
    group,
    Array.from({ length: 10 }, (_, index) => demoPerson(group, index)),
  ]),
) as Record<DemoGroup, DemoPerson[]>;

async function worldFixture(
  page: Page,
  options: {
    enabled?: boolean;
    configFailures?: number;
    userFailures?: number;
    discovery?: boolean;
  } = {},
) {
  let selected = people.men[0];
  let configFailures = options.configFailures || 0,
    userFailures = options.userFailures || 0;
  let resetStatus = 200,
    changed = true;
  let resetGate: Promise<void> | null = null;
  const queries: URLSearchParams[] = [],
    entries: string[] = [],
    resets: any[] = [],
    unexpected: string[] = [];
  let logouts = 0;
  const state = () => ({
    features: { gamesV2: true },
    me: {
      ...selected,
      bio: changed
        ? "Synthetic profile changed during a previous demo journey"
        : selected.bio,
      email: "fictional@example.test",
      email_verified_at: new Date().toISOString(),
      adult_declared_at: new Date().toISOString(),
      onboarded_at: new Date().toISOString(),
      onboarding_step: 5,
      birth_date: "1995-01-01",
      paused: false,
      notifications: true,
      posts_visible: true,
      stories_visible: true,
      messages_enabled: true,
      interactions_enabled: true,
      data_saver: false,
      preferences: { cities: [], genders: [], minAge: 18, maxAge: 60 },
    },
    matches: [selected.demo_group === "men" ? people.women[0] : people.men[0]],
    discover: options.discovery ? [people.women[1]] : [],
    undoId: null,
    feed: [],
    stories: [],
    notifications: [],
    games: [],
  });
  await page.route("**/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.slice(3),
      method = request.method();
    const reply = (json: unknown, status = 200) =>
      route.fulfill({
        status,
        json,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    if (method === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      });
    if (path === "/demo/config")
      return configFailures-- > 0
        ? reply({ message: "Synthetic config outage" }, 503)
        : reply({
            enabled: options.enabled !== false,
            version: 1,
            groups: { men: 10, women: 10, lgbtq: 10 },
          });
    if (path === "/demo/users") {
      queries.push(url.searchParams);
      if (userFailures-- > 0)
        return reply({ message: "Synthetic selector outage" }, 503);
      const group = url.searchParams.get("group") as DemoGroup;
      const offset = Number(url.searchParams.get("cursor") || 0);
      const limit = Number(url.searchParams.get("limit"));
      return reply({
        items: people[group].slice(offset, offset + limit),
        nextCursor: offset + limit < 10 ? String(offset + limit) : null,
      });
    }
    if (path === "/auth/config")
      return reply({
        google: {
          enabled: false,
          webClientId: "",
          androidClientId: "",
          iosClientId: "",
        },
        email: { enabled: true },
        demo: options.enabled !== false,
      });
    if (path === "/auth/demo" && method === "POST") {
      const { id } = request.postDataJSON();
      entries.push(id);
      selected = groups
        .flatMap((group) => people[group])
        .find((person) => person.id === id)!;
      return reply({ token: `synthetic-demo-${id}` });
    }
    if (path === "/state") return reply(state());
    if (path === "/demo/reset") {
      resets.push(request.postDataJSON());
      if (resetGate) await resetGate;
      if (resetStatus !== 200)
        return reply({ message: "Synthetic reset unavailable" }, resetStatus);
      changed = false;
      return reply({ ok: true });
    }
    if (path === "/logout") {
      logouts++;
      return reply({ ok: true });
    }
    if (path.startsWith("/profiles/"))
      return reply(
        groups
          .flatMap((group) => people[group])
          .find((person) => path.endsWith(person.id)),
      );
    if (path.startsWith("/chat/"))
      return reply({
        person: selected.demo_group === "men" ? people.women[0] : people.men[0],
        games: [],
        hasMore: false,
        timeline: [
          {
            id: `synthetic-private-${selected.id}`,
            type: "message",
            sender: selected.id,
            body:
              selected.demo_group === "men"
                ? "Synthetic first-account private conversation"
                : "Synthetic second-account private conversation",
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      });
    if (["/matches", "/stories", "/notifications", "/discover"].includes(path))
      return reply({ items: [], nextCursor: null, hasMore: false });
    unexpected.push(`${method} ${path}`);
    return reply({ message: "Unexpected synthetic route" }, 404);
  });
  return {
    queries,
    entries,
    resets,
    unexpected,
    logouts: () => logouts,
    resetStatus: (value: number) => {
      resetStatus = value;
    },
    holdReset: () => {
      let release!: () => void;
      resetGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
  };
}

test("demo-first entry pages six fictional profiles per group without loading the whole world", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const fixture = await worldFixture(page, { discovery: true });
  await page.goto("/welcome");
  await expect(page.getByText("Sangai Beta", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Enter as / })).toHaveCount(6);
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toHaveCount(0);
  expect(fixture.queries.map((query) => query.get("group"))).toEqual(["men"]);
  expect(fixture.queries[0].get("limit")).toBe("6");
  await page
    .getByRole("button", { name: "Load more profiles", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /^Enter as / })).toHaveCount(
    10,
  );
  await expect(
    page.getByRole("button", { name: "Load more profiles", exact: true }),
  ).toHaveCount(0);
  expect(fixture.queries[1].get("cursor")).toBe("6");
  await page.getByRole("button", { name: "Women", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Enter as Fictional Woman 1",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Enter as / })).toHaveCount(6);
  await page
    .getByRole("button", { name: "LGBTQ+ / Other", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Enter as Fictional Person 1",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("they/them · Pansexual", { exact: true }).first(),
  ).toBeVisible();
  expect(fixture.entries).toEqual([]);
  expect(fixture.unexpected).toEqual([]);
  await page.getByRole("button", { name: "Men", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter as Fictional Man 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "View Fictional Woman 2's profile",
      exact: true,
    }),
  ).toBeVisible();
  // These core actions must fit above navigation on the first small-phone
  // screen. Checking their scroll clipping avoids Playwright auto-scroll
  // making a partly hidden control appear reachable during a later click.
  for (const name of ["Pass", "Like", "Super Like"]) {
    const control = page.getByRole("button", { name, exact: true });
    const fullyVisible = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      let top = 0,
        bottom = window.innerHeight;
      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (
          ["auto", "scroll", "hidden", "clip"].includes(
            getComputedStyle(parent).overflowY,
          )
        ) {
          const bounds = parent.getBoundingClientRect();
          top = Math.max(top, bounds.top);
          bottom = Math.min(bottom, bounds.bottom);
        }
      }
      return rect.top >= top && rect.bottom <= bottom;
    });
    expect(
      fullyVisible,
      `${name} should fit without scrolling at 360×640`,
    ).toBe(true);
  }
});

test("switching demo perspectives uses the real session transition and removes the previous private conversation draft", async ({
  page,
}) => {
  const fixture = await worldFixture(page);
  await page.goto("/welcome");
  await page
    .getByRole("button", { name: "Enter as Fictional Man 1", exact: true })
    .click();
  await page.getByRole("tab", { name: "Chat", exact: false }).click();
  await page
    .getByRole("button", { name: "Chat with Fictional Woman 1", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic first-account private conversation", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByPlaceholder("A thought, a question, a hello…")
    .fill("Synthetic first account unsent draft");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("button", { name: "Switch demo user", exact: true })
    .click();
  await page.getByRole("button", { name: "Women", exact: true }).click();
  await page
    .getByRole("button", {
      name: "View Fictional Woman 1 profile",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`/profile/${people.women[0].id}$`));
  await expect(
    page.getByText(people.women[0].bio, { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter as Fictional Woman 1", exact: true })
    .click();
  await expect(
    page.getByText("DEMO MODE · Fictional Woman 1", { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Chat", exact: false }).click();
  await page
    .getByRole("button", { name: "Chat with Fictional Man 1", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic second-account private conversation", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic first-account private conversation", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByPlaceholder("A thought, a question, a hello…"),
  ).toHaveValue("");
  expect(fixture.entries).toEqual([people.men[0].id, people.women[0].id]);
  expect(fixture.logouts()).toBe(0);
  expect(fixture.unexpected).toEqual([]);
});

test("Reset Demo requires confirmation, preserves failures and restores the baseline after a retry", async ({
  page,
}) => {
  const fixture = await worldFixture(page);
  await page.goto("/welcome");
  await page
    .getByRole("button", { name: "Enter as Fictional Man 1", exact: true })
    .click();
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page.getByRole("button", { name: "Reset Demo", exact: true }).click();
  await expect(
    page.getByText("Reset demo data?", { exact: true }),
  ).toBeVisible();
  expect(fixture.resets).toEqual([]);
  await page
    .getByRole("button", { name: "Keep current demo", exact: true })
    .click();
  expect(fixture.resets).toEqual([]);
  await page.getByRole("button", { name: "Reset Demo", exact: true }).click();
  fixture.resetStatus(503);
  await page
    .getByRole("button", { name: "Reset all demo data", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic reset unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset all demo data", exact: true }),
  ).toBeEnabled();
  fixture.resetStatus(200);
  const release = fixture.holdReset();
  await page
    .getByRole("button", { name: "Reset all demo data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Resetting demo…", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => fixture.resets.length).toBe(2);
  release();
  await expect(page.getByText("Reset demo data?", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await expect(
    page.getByText(people.men[0].bio, { exact: true }),
  ).toBeVisible();
  expect(fixture.resets).toEqual([{ confirm: true }, { confirm: true }]);
  expect(fixture.unexpected).toEqual([]);
});

test("demo configuration and selector outages have retry recovery without flashing signup", async ({
  page,
}) => {
  const fixture = await worldFixture(page, {
    configFailures: 1,
    userFailures: 1,
  });
  await page.goto("/welcome");
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Connection settings", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Backend URL", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close sheet", exact: true }).click();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page
    .getByRole("button", { name: "Retry loading demos", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /^Enter as / })).toHaveCount(6);
  expect(fixture.entries).toEqual([]);
  expect(fixture.unexpected).toEqual([]);
});

test("disabled demo mode preserves normal authentication and hides every demo entry", async ({
  page,
}) => {
  const fixture = await worldFixture(page, { enabled: false });
  await page.goto("/welcome");
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Enter as / })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Switch demo user", exact: true }),
  ).toHaveCount(0);
  await page.goto("/demo");
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  expect(fixture.queries).toEqual([]);
  expect(fixture.entries).toEqual([]);
  expect(fixture.unexpected).toEqual([]);
});
