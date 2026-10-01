import { expect, test, type Page } from "@playwright/test";
import { invitationTime } from "../../apps/mobile/src/lib/dateInvitation";
import { findConversationGame } from "../../apps/mobile/src/lib/gameHistory";

test("date validation rejects calendar, past and daylight-saving gaps without changing valid local time", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Australia/Sydney";
    const now = new Date("2026-10-01T00:00:00Z");
    expect(invitationTime("2026-10-04", "02:30", now).error).toContain(
      "clocks change",
    );
    expect(invitationTime("2027-02-30", "17:00", now).error).toContain(
      "calendar date",
    );
    expect(invitationTime("2026-09-30", "17:00", now).error).toContain(
      "future",
    );
    expect(
      invitationTime("2027-01-02", "25:00", now).scheduled,
    ).toBeUndefined();
    process.env.TZ = "Asia/Kathmandu";
    expect(
      invitationTime("2027-01-02", "17:00", now).scheduled?.toISOString(),
    ).toBe("2027-01-02T11:15:00.000Z");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("old games resolve from the authorized cursor and missing games terminate", async () => {
  const calls: string[] = [];
  const old = {
    id: "old-game",
    type: "game",
    created_at: "2026-09-01T09:00:00.000Z",
  };
  const request = async <T>(path: string): Promise<T> => {
    calls.push(path);
    return (
      path.includes("?before=")
        ? { games: [], timeline: [old] }
        : { games: [{ id: "new-game" }], timeline: [] }
    ) as T;
  };
  expect(
    await findConversationGame(request, "match", old.id, old.created_at),
  ).toEqual(old);
  expect(calls).toEqual([
    "/chat/match",
    "/chat/match?before=2026-09-01T09%3A00%3A00.001Z",
  ]);
  expect(await findConversationGame(request, "match", "missing")).toBeNull();
  const denied = async () => {
    throw Object.assign(new Error("Match unavailable"), { status: 403 });
  };
  await expect(
    findConversationGame(denied, "match", old.id, old.created_at),
  ).rejects.toMatchObject({ status: 403 });
});

async function demo(page: Page, transform?: (state: any) => any) {
  if (transform)
    await page.route("**/v1/state", async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, json: transform(await response.json()) });
    });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  const state = page.waitForResponse(
    (response) => response.url().endsWith("/v1/state") && response.ok(),
  );
  await page
    .getByRole("button", { name: "Try Aarav demo account", exact: true })
    .click();
  const value = await (await state).json();
  await expect(
    page.getByRole("tab", { name: "Discover", exact: false }),
  ).toBeVisible();
  return value;
}
async function openChat(page: Page) {
  await page.getByRole("tab", { name: "Chat", exact: false }).click();
  await page
    .getByRole("button", { name: "Chat with Anaya", exact: true })
    .click();
}
async function conversationAction(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Conversation actions", exact: true })
    .click();
  await page.getByRole("button", { name, exact: true }).click();
}

// Failure fixtures stay in the browser; these tests never change real profile,
// match, gallery, settings, game or notification records.
test("profile visibility is rechecked after returning from safety", async ({
  page,
}) => {
  const state = await demo(page);
  const person = state.matches.find((p: any) => p.name === "Anaya");
  expect(person).toBeTruthy();
  let available = true;
  let reads = 0;
  await page.route(`**/v1/profiles/${person.id}`, (route) => {
    reads++;
    return route.fulfill({
      status: available ? 200 : 404,
      json: available ? person : { message: "Profile unavailable." },
    });
  });
  await openChat(page);
  await page.getByRole("button", { name: "View profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Profile options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Safety & privacy", exact: true })
    .click();
  available = false;
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByText("Profile unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry profile", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open your conversation", exact: true }),
  ).toHaveCount(0);
  expect(reads).toBeGreaterThanOrEqual(2);
});

test("written profile drafts require keep-or-discard before leaving", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByRole("button", { name: "The basics", exact: true }).click();
  await page
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Unsaved synthetic draft");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByText("Leave without saving?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "First name", exact: true }),
  ).toHaveValue("Unsaved synthetic draft");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard written changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit profile", exact: true }),
  ).toBeVisible();
});

test("settings wait for the request and roll back after failure, with honest web push availability", async ({
  page,
}) => {
  const state = await demo(page);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route("**/v1/settings", async (route) => {
    writes++;
    expect(route.request().postDataJSON()).toEqual({
      posts_visible: !state.me.posts_visible,
    });
    await waiting;
    await route.fulfill({
      status: 500,
      json: { message: "Synthetic server failure" },
    });
  });
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page
    .getByRole("button", { name: "Profile settings", exact: true })
    .click();
  const setting = page.getByRole("switch", {
    name: "Share posts with matches",
    exact: true,
  });
  await setting.click();
  await expect(setting).toBeDisabled();
  await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
  release();
  await expect(setting).toBeEnabled();
  await expect(setting).toBeChecked({ checked: state.me.posts_visible });
  expect(writes).toBe(1);
  await expect(
    page.getByRole("button", {
      name: "Enable push on this device",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Your in-app Activity inbox works here/),
  ).toBeVisible();
});

test("invalid date details stay before Review and valid details preserve the invitation payload", async ({
  page,
}) => {
  const state = await demo(page);
  const person = state.matches.find((p: any) => p.name === "Anaya");
  await openChat(page);
  await conversationAction(page, "Plan a Date");
  await page.getByRole("button", { name: "Coffee", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Date · YYYY-MM-DD", exact: true })
    .fill("2027-02-30");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Choose a valid calendar date.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send date invitation", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Date · YYYY-MM-DD", exact: true })
    .fill("2099-01-02");
  await page
    .getByRole("textbox", {
      name: "Time · HH:MM · your local time",
      exact: true,
    })
    .fill("17:00");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.route(`**/v1/plans/${person.id}`, async (route) => {
    const body = route.request().postDataJSON();
    expect(Object.keys(body).sort()).toEqual(["scheduledAt", "title", "venue"]);
    expect(body.title).toBe("Coffee");
    expect(body.venue).toBe("");
    expect(Number.isFinite(new Date(body.scheduledAt).getTime())).toBe(true);
    await route.fulfill({ json: { id: "synthetic-plan" } });
  });
  await page
    .getByRole("button", { name: "Send date invitation", exact: true })
    .click();
  await expect(
    page.getByText("Date idea sent. Your match can accept or decline.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("missing game shows an unavailable state instead of an endless skeleton", async ({
  page,
}) => {
  const state = await demo(page);
  const person = state.matches.find((p: any) => p.name === "Anaya");
  const id = "00000000-0000-4000-8000-000000000000";
  const stale = {
    id,
    type: "game",
    kind: "this-or-that",
    state: "complete",
    complete: true,
    created_at: "2026-09-01T09:00:00Z",
  };
  let show = true;
  await page.route(`**/v1/chat/${person.id}`, (route) =>
    route.fulfill({
      json: {
        person,
        games: show ? [stale] : [],
        timeline: show ? [stale] : [],
        hasMore: false,
      },
    }),
  );
  await openChat(page);
  const open = page.getByRole("button", {
    name: "This or that · complete",
    exact: true,
  });
  await expect(open).toBeVisible();
  show = false;
  await open.click();
  await expect(
    page.getByText("Game unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to Chat", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry game", exact: true }),
  ).toHaveCount(0);
});

test("an older game opened from Earlier conversation reaches its authorized reveal", async ({
  page,
}) => {
  const state = await demo(page);
  const person = state.matches.find((p: any) => p.name === "Anaya");
  const id = "00000000-0000-4000-8000-000000000003";
  const createdAt = "2026-09-01T09:00:00.000Z";
  const old = {
    id,
    type: "game",
    kind: "this-or-that",
    state: "complete",
    host: state.me.id,
    guest: person.id,
    answered: true,
    bothAnswered: true,
    complete: true,
    created_at: createdAt,
    answers: { [state.me.id]: [0, 0, 0, 0, 0], [person.id]: [1, 1, 1, 1, 1] },
    guesses: {},
    expires_at: "2026-09-01T09:02:00Z",
  };
  let revealCursor = false;
  await page.route(`**/v1/chat/${person.id}*`, (route) => {
    const before = new URL(route.request().url()).searchParams.get("before");
    if (before === "2026-09-01T09:00:00.001Z") revealCursor = true;
    return route.fulfill({
      json: {
        person,
        games: Array.from({ length: 20 }, (_, index) => ({
          id: `synthetic-recent-${index}`,
        })),
        timeline: before
          ? [old]
          : [
              {
                id: "00000000-0000-4000-8000-000000000004",
                type: "message",
                sender: state.me.id,
                body: "Synthetic recent conversation",
                created_at: "2026-10-01T09:00:00Z",
              },
            ],
        hasMore: !before,
      },
    });
  });
  await openChat(page);
  await page
    .getByRole("button", { name: "Earlier conversation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "This or that · complete", exact: true })
    .click();
  await expect(
    page.getByText("A little more to talk about.", { exact: true }),
  ).toBeVisible();
  expect(revealCursor).toBe(true);
});

test("gallery removal confirms, locks during the request and preserves media after failure", async ({
  page,
}) => {
  const mediaId = "00000000-0000-4000-8000-000000000001";
  await demo(page, (state) => ({
    ...state,
    me: { ...state.me, media: [{ id: mediaId, kind: "video" }] },
  }));
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route(`**/v1/profile/media/${mediaId}`, async (route) => {
    writes++;
    expect(route.request().method()).toBe("DELETE");
    await waiting;
    await route.fulfill({
      status: 500,
      json: { message: "Synthetic removal failure" },
    });
  });
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Your first impression", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove from profile", exact: true })
    .click();
  expect(writes).toBe(0);
  await page
    .getByRole("button", { name: "Remove photo or video", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Removing…", exact: true }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Remove photo or video", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Keep on profile", exact: true })
    .click();
  await expect(page.getByText("Profile video", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
});

test("two-truths answers cannot be edited during submission and failure preserves the draft", async ({
  page,
}) => {
  const state = await demo(page);
  const person = state.matches.find((p: any) => p.name === "Anaya");
  const id = "00000000-0000-4000-8000-000000000002";
  const game = {
    id,
    type: "game",
    created_at: "2026-10-01T09:00:00Z",
    kind: "two-truths",
    state: "active",
    host: state.me.id,
    guest: person.id,
    answered: false,
    bothAnswered: false,
    complete: false,
    answers: {},
    guesses: {},
    expires_at: "2099-01-02T00:00:00Z",
  };
  await page.route(`**/v1/chat/${person.id}`, (route) =>
    route.fulfill({
      json: { person, games: [game], timeline: [game], hasMore: false },
    }),
  );
  await page.route(`**/v1/game-ready/${person.id}`, (route) =>
    route.fulfill({ json: { self: true, partner: true } }),
  );
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/v1/game/${id}/answer`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      answers: {
        statements: ["Synthetic one", "Synthetic two", "Synthetic three"],
        lie: 2,
      },
    });
    await waiting;
    await route.fulfill({
      status: 500,
      json: { message: "Synthetic answer failure" },
    });
  });
  await openChat(page);
  await page
    .getByRole("button", {
      name: `${state.games.find((g: any) => g.id === "two-truths").title} · active`,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "I’m Ready to play", exact: true })
    .click();
  for (const [index, value] of [
    "Synthetic one",
    "Synthetic two",
    "Synthetic three",
  ].entries()) {
    await page
      .getByRole("textbox", { name: `Statement ${index + 1}`, exact: true })
      .fill(value);
  }
  const lie = page.getByRole("button", {
    name: "Statement 3 is the lie",
    exact: true,
  });
  await lie.click();
  await page
    .getByRole("button", { name: "Lock in my statements", exact: true })
    .click();
  const first = page.getByRole("textbox", { name: "Statement 1", exact: true });
  await expect(first).not.toBeEditable();
  await expect(lie).toBeDisabled();
  release();
  await expect(first).toBeEditable();
  await expect(first).toHaveValue("Synthetic one");
  await expect(lie).toBeEnabled();
});

test("ready status waits for consent request and keeps game invitations disabled", async ({
  page,
}) => {
  const state = await demo(page);
  const person = state.matches.find((p: any) => p.name === "Anaya");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route(`**/v1/game-ready/${person.id}`, async (route) => {
    if (route.request().method() === "POST") {
      writes++;
      expect(route.request().postDataJSON()).toEqual({ enabled: true });
      await waiting;
      await route.fulfill({ json: { self: true, partner: false } });
    } else await route.fulfill({ json: { self: false, partner: false } });
  });
  await openChat(page);
  await conversationAction(page, "Dating games");
  await page
    .getByRole("button", { name: "I’m Ready to play", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Updating readiness…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Invite to This or that", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => writes).toBe(1);
  release();
  await expect(
    page.getByRole("button", { name: "Stop being ready", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Invite to This or that", exact: true }),
  ).toBeDisabled();
});

test("Activity offers mark-all only for unread updates and disables it while saving", async ({
  page,
}) => {
  let read = true;
  await demo(page, (state) => ({
    ...state,
    notifications: [
      {
        id: "synthetic-update",
        kind: "game",
        body: "Synthetic game update",
        read,
        created_at: "2026-10-01T00:00:00Z",
      },
    ],
  }));
  await page.getByRole("tab", { name: "Chat", exact: false }).click();
  await page
    .getByRole("button", { name: "Open activity", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic game update", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark updates as read", exact: true }),
  ).toHaveCount(0);
  read = false;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/v1/notifications/read", async (route) => {
    await waiting;
    await route.fulfill({
      status: 500,
      json: { message: "Synthetic notification failure" },
    });
  });
  const mark = page.getByRole("button", {
    name: "Mark updates as read",
    exact: true,
  });
  await expect(mark).toBeVisible({ timeout: 15000 });
  await mark.click();
  await expect(
    page.getByRole("button", { name: "Marking as read…", exact: true }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Mark updates as read", exact: true }),
  ).toBeEnabled();
});
