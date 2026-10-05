import { expect, test, type Page } from "@playwright/test";
import type { Person, State } from "../../apps/mobile/src/lib/types";

// Every endpoint is intercepted: no production accounts, messages, posts,
// readiness changes or provider requests are created by this visual regression.
const meId = "81000000-0000-4000-8000-000000000001";
const matchId = "81000000-0000-4000-8000-000000000002";
const candidateId = "81000000-0000-4000-8000-000000000003";
function person(id: string, name: string): Person {
  return {
    id,
    name,
    age: 28,
    city: "Kathmandu",
    demo: true,
    bio: "Coffee, books and weekend walks.",
    intent: "Serious relationship",
    gender: "Woman",
    interests: ["Coffee", "Reading", "Hiking"],
    prompt: "My favourite weekend starts with a walk.",
    languages: ["Nepali", "English"],
    hobbies: [],
    profession: "",
    education: "",
    lifestyle: {},
    media: [],
    color: "#F8E9DE",
  };
}
const me = { ...person(meId, "Arjun"), gender: "Man" };
const partner = {
  ...person(matchId, "Maya"),
  preview: "Shall we find a café?",
  unread: 2,
};
const candidate = { ...person(candidateId, "Nisha"), intent: "Marriage" };
async function fixture(page: Page, failLogout = false) {
  let active = true,
    logoutAttempts = 0;
  const mutations: { path: string; body: unknown }[] = [];
  const state: State = {
    me: {
      ...me,
      email: "ui-fixture@example.test",
      email_verified_at: "2026-01-01T00:00:00Z",
      adult_declared_at: "2026-01-01T00:00:00Z",
      onboarded_at: "2026-01-01T00:00:00Z",
      onboarding_step: 5,
      birth_date: "1998-01-01",
      paused: false,
      notifications: false,
      posts_visible: true,
      stories_visible: true,
      messages_enabled: true,
      interactions_enabled: true,
      data_saver: false,
      preferences: {
        cities: ["Kathmandu"],
        genders: ["Woman"],
        minAge: 21,
        maxAge: 35,
        intents: ["Serious relationship", "Marriage", "Casual dating"],
      },
    },
    features: { gamesV2: true },
    discover: [candidate],
    matches: [partner],
    stories: [
      {
        id: "82000000-0000-4000-8000-000000000001",
        author: partner,
        body: "A fictional weekend moment.",
        expires_at: "2099-01-01T00:00:00Z",
      },
    ],
    feed: [
      {
        id: "83000000-0000-4000-8000-000000000001",
        author: partner,
        body: "A quiet morning at the café.",
        created_at: "2026-10-01T08:00:00Z",
        likes: 0,
        liked: false,
        saved: false,
        comments: [],
      },
      {
        id: "83000000-0000-4000-8000-000000000002",
        author: me,
        body: "What is your favourite weekend walk?",
        created_at: "2026-10-01T07:00:00Z",
        likes: 0,
        liked: false,
        saved: false,
        comments: [],
      },
    ],
    notifications: [],
    games: [],
    undoId: null,
  };
  await page.route("**/v1/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.slice(3);
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ status, json });
    if (path === "/demo/config")
      return reply({
        enabled: true,
        mode: true,
        version: 1,
        groups: { men: 10, women: 10, lgbtq: 10 },
      });
    if (path === "/auth/config")
      return reply({ google: false, localMail: true, otpConfigured: true });
    if (path === "/auth/session")
      return active
        ? reply({ csrfToken: "synthetic-ui-csrf" })
        : reply({ message: "Please sign in." }, 401);
    if (path === "/state") return reply(state);
    if (path === "/demo/users") return reply({ items: [], nextCursor: null });
    if (path.startsWith("/profiles/"))
      return reply(
        path.endsWith(meId) ? me : path.endsWith(matchId) ? partner : candidate,
      );
    if (path === "/chat/" + matchId)
      return reply({
        person: partner,
        timeline: [
          {
            id: "84000000-0000-4000-8000-000000000001",
            type: "message",
            sender: matchId,
            recipient: meId,
            body: "Shall we find a café?",
            created_at: "2026-10-01T09:00:00Z",
          },
          {
            id: "84000000-0000-4000-8000-000000000002",
            type: "message",
            sender: meId,
            recipient: matchId,
            body: "That sounds lovely.",
            created_at: "2026-10-01T09:01:00Z",
          },
        ],
      });
    if (path.startsWith("/chat-history/")) return reply([]);
    if (path === "/settings") {
      expect(request.method()).toBe("PATCH");
      const body = request.postDataJSON();
      mutations.push({ path, body });
      Object.assign(state.me, body);
      return reply({ ok: true });
    }
    if (path === "/logout") {
      expect(request.method()).toBe("POST");
      expect(request.headers()["x-csrf-token"]).toBe("synthetic-ui-csrf");
      logoutAttempts++;
      if (failLogout && logoutAttempts === 1)
        return reply({ message: "Synthetic logout outage" }, 503);
      active = false;
      mutations.push({ path, body: request.postDataJSON() });
      return reply({ ok: true });
    }
    return reply({ message: "Unexpected fixture endpoint: " + path }, 404);
  });
  return {
    mutations,
    get logoutAttempts() {
      return logoutAttempts;
    },
  };
}
async function navigate(page: Page, name: string, wide = false) {
  await page
    .getByRole(wide ? "link" : "tab", {
      name: wide ? "Navigate to " + name : new RegExp(name),
      exact: wide,
    })
    .click();
}
async function fits(page: Page, width: number) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
}
test("mobile layouts keep core actions reachable and grouped settings retain their PATCH contract", async ({
  page,
}) => {
  const data = await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "View Nisha's profile", exact: true }),
  ).toBeVisible();
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await fits(page, width);
    for (const label of ["Pass", "Like", "Super Like"]) {
      const action = page.getByRole("button", { name: label, exact: true });
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/ui-refinement/discover-mobile.png",
  });
  await navigate(page, "Chat");
  await expect(
    page.getByRole("button", { name: "Chat with Maya", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your matches’ moments will appear here."),
  ).toHaveCount(0);
  await page.screenshot({ path: "artifacts/ui-refinement/chat-mobile.png" });
  await navigate(page, "Sangai");
  await expect(
    page.getByText("A quiet morning at the café.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/ui-refinement/feed-mobile.png" });
  await page.getByRole("button", { name: "Create Post", exact: true }).click();
  const draft = page.getByRole("textbox", {
    name: "What’s on your mind?",
    exact: true,
  });
  await expect(draft).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Post", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: "artifacts/ui-refinement/compose-mobile.png" });
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await navigate(page, "Profile");
  await expect(
    page.getByRole("button", { name: "Edit profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("YOUR PROFILE AT A GLANCE", { exact: true }),
  ).toBeVisible();
  // Account controls stay accessible; the full gallery belongs in Preview.
  await expect(
    page.getByRole("button", { name: "Open privacy settings", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "artifacts/ui-refinement/profile-mobile.png" });
  await page
    .getByRole("button", { name: "Open discovery settings", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Pause discovery", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Share posts with matches", exact: true }),
  ).toHaveCount(0);
  expect(data.mutations).toEqual([]);
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  await page
    .getByRole("switch", { name: "Share posts with matches", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Share posts with matches", exact: true }),
  ).not.toBeChecked();
  expect(data.mutations).toEqual([
    { path: "/settings", body: { posts_visible: false } },
  ]);
});
test("desktop uses four navigation links and keeps conversation alongside its match list", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  for (const label of ["Discover", "Chat", "Sangai", "Profile"])
    await expect(
      page.getByRole("link", { name: "Navigate to " + label, exact: true }),
    ).toBeVisible();
  await fits(page, 1440);
  await navigate(page, "Chat", true);
  await page
    .getByRole("button", { name: "Chat with Maya", exact: true })
    .click();
  await expect(page.getByTestId("conversation-sidebar")).toBeVisible();
  await expect(
    page.getByPlaceholder("A thought, a question, a hello…"),
  ).toBeVisible();
  await expect(
    page.getByText("That sounds lovely.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/ui-refinement/conversation-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("conversation-sidebar")).toHaveCount(0);
  await fits(page, 390);
  await expect(
    page.getByPlaceholder("A thought, a question, a hello…"),
  ).toBeVisible();
});
test("profile own-account action preserves demo session on logout failure and supports retry", async ({
  page,
}) => {
  const data = await fixture(page, true);
  await page.goto("/");
  await navigate(page, "Profile");
  const own = page.getByRole("button", {
    name: "Use my own account",
    exact: true,
  });
  await own.click();
  await expect(own).toBeEnabled();
  await expect(
    page.getByRole("button", {
      name: "Return to current demo account",
      exact: true,
    }),
  ).toBeVisible();
  await own.click();
  await expect(page).toHaveURL(/\/welcome\?account=1$/);
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  expect(data.logoutAttempts).toBe(2);
});
