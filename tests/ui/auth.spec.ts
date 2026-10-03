import { expect, test, type Page } from "@playwright/test";
import type { State } from "../../apps/mobile/src/lib/types";

// Real authentication is retained for the later account phase. These cases
// explicitly select that UI without changing the server's shared demo mode.
const normalConfig = {
  enabled: false,
  version: 1,
  groups: { men: 10, women: 10, lgbtq: 10 },
};
test.beforeEach(async ({ page }) => {
  await page.route("**/v1/demo/config", (route) =>
    route.fulfill({ json: normalConfig }),
  );
});
const completedNormalAccount: State = {
  me: {
    id: "81000000-0000-4000-8000-000000000001",
    name: "Synthetic Account",
    age: 29,
    city: "Kathmandu",
    bio: "Synthetic auth-recovery fixture",
    intent: "Serious relationship",
    interests: ["Art"],
    prompt: "A quiet coffee and a walk.",
    gender: "Woman",
    color: "#F2D7CC",
    demo: false,
    languages: ["Nepali"],
    hobbies: [],
    profession: "",
    education: "",
    lifestyle: {},
    email: "synthetic-auth@example.test",
    email_verified_at: "2026-10-02T08:00:00Z",
    adult_declared_at: "2026-10-02T08:00:00Z",
    onboarded_at: "2026-10-02T08:00:00Z",
    onboarding_step: 5,
    birth_date: "1997-04-01",
    paused: false,
    notifications: false,
    posts_visible: true,
    stories_visible: true,
    messages_enabled: true,
    interactions_enabled: true,
    data_saver: false,
    preferences: {
      cities: [],
      genders: [],
      intents: [],
      minAge: 21,
      maxAge: 35,
    },
  },
  features: { gamesV2: true },
  matches: [],
  discover: [],
  undoId: null,
  feed: [],
  stories: [],
  notifications: [],
  games: [],
};
async function mockNormalSession(
  page: Page,
  unavailableState: () => boolean = () => false,
) {
  // Every endpoint for these two store/routing cases is intercepted; no server
  // user, credential, fixture match or external provider request is created.
  await page.route("**/v1/**", async (route) => {
    if (new URL(route.request().url()).pathname === "/v1/auth/session")
      return route.fulfill({
        status: 401,
        json: { message: "Please sign in." },
      });
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/demo/config")
      return route.fulfill({ json: normalConfig });
    if (path === "/v1/auth/config")
      return route.fulfill({
        json: { google: false, localMail: true, otpConfigured: true },
      });
    if (["/v1/auth/login", "/v1/auth/register"].includes(path))
      return route.fulfill({ json: { csrfToken: "synthetic-auth-session" } });
    if (path === "/v1/state") {
      if (unavailableState()) return route.abort();
      return route.fulfill({ json: completedNormalAccount });
    }
    if (path === "/v1/logout") return route.fulfill({ json: { ok: true } });
    return route.fulfill({
      status: 404,
      json: { message: "No synthetic fixture for that action." },
    });
  });
}

test("successful authentication with an unavailable state request has explicit retry recovery", async ({
  page,
}) => {
  let offline = true;
  await mockNormalSession(page, () => offline);
  await page.goto("/");
  await page
    .getByRole("button", { name: "I already have an account", exact: true })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill("synthetic-auth@example.test");
  await page
    .getByLabel("Password · at least 10 characters", { exact: true })
    .fill("synthetic-fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Let’s reconnect", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  offline = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Discover", exact: false }),
  ).toHaveAttribute("aria-selected", "true");
});

test("signup validates email and adult consent before issuing an account request", async ({
  page,
}) => {
  await mockNormalSession(page);
  const registerRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/v1/auth/register")
    )
      registerRequests.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continue with email", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("invalid-email");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Enter a valid email address.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Email", { exact: true })
    .fill("synthetic-validation@example.test");
  await page
    .getByLabel("Password · at least 10 characters", { exact: true })
    .fill("a-synthetic-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(
      "Confirm you’re 18 or older and accept the beta policies to continue.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(registerRequests).toEqual([]);
});

test("signing out returns to Welcome and clears the retained signup fields", async ({
  page,
}) => {
  await mockNormalSession(page);
  page.on("pageerror", (error) =>
    console.error("Auth browser error:", error.message),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continue with email", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("unsaved@example.test");
  await page
    .getByLabel("Password · at least 10 characters", { exact: true })
    .fill("unsaved-synthetic-password");
  await page
    .getByText(
      "I am 18 or older and agree to the beta terms, privacy policy and community rules.",
      { exact: true },
    )
    .click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page.getByLabel("Profile settings", { exact: true }).click();
  const loggedOut = page.waitForResponse((response) =>
    response.url().endsWith("/v1/logout"),
  );
  await page
    .getByRole("button", {
      name: "Sign out",
      exact: true,
    })
    .click();
  expect((await loggedOut).ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue with email", exact: true })
    .click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
  await expect(
    page.getByLabel("Password · at least 10 characters", { exact: true }),
  ).toHaveValue("");
});

test("a signed-out protected deep link returns to Welcome while reset remains public", async ({
  page,
}) => {
  await page.goto("/edit-profile");
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/welcome$/);
  await page.goto("/reset-password");
  await expect(
    page.getByRole("button", { name: "Send reset code", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password$/);
});

test("password reset reads a local email code, rejects a wrong code and signs in with the new password", async ({
  page,
  request,
}) => {
  const email = `ui-reset-${Date.now()}@example.test`;
  const password = "synthetic-reset-password";
  const newPassword = "changed-synthetic-reset-password";
  const registered = await request.post(
    "http://localhost:4100/v1/auth/register",
    {
      data: { email, password, acceptedPolicies: true },
    },
  );
  expect(registered.ok()).toBe(true);
  let token = (await registered.json()).token;
  try {
    await page.goto("/reset-password");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByRole("button", { name: "Send reset code", exact: true })
      .click();
    let code = "";
    await expect
      .poll(async () => {
        const list = await (
          await request.get("http://localhost:8025/api/v1/messages")
        ).json();
        const message = list.messages.find((m: any) =>
          m.To.some((to: any) => to.Address === email),
        );
        if (!message) return false;
        const detail = await (
          await request.get(
            `http://localhost:8025/api/v1/message/${message.ID}`,
          )
        ).json();
        code = detail.Text.match(/\b\d{6}\b/)?.[0] || "";
        return !!code;
      })
      .toBe(true);
    await expect(
      page.getByText("u***@example.test", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resend reset code", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Reset code from your email", { exact: true })
      .fill(code === "000000" ? "000001" : "000000");
    await page
      .getByLabel("New password · at least 10 characters", { exact: true })
      .fill(newPassword);
    await page
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await expect(
      page.getByText("Code is invalid or expired. Request a new code.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByLabel("Reset code from your email", { exact: true })
      .fill(code);
    await page
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await page
      .getByRole("button", { name: "I already have an account", exact: true })
      .click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password · at least 10 characters", { exact: true })
      .fill(newPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByText("Verify your email", { exact: true }),
    ).toBeVisible();
  } finally {
    const session = await fetch("http://localhost:4100/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: newPassword }),
      signal: AbortSignal.timeout(5000),
    });
    if (session.ok) token = (await session.json()).token;
    await fetch("http://localhost:4100/v1/account", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirm: "DELETE" }),
      signal: AbortSignal.timeout(5000),
    });
  }
});
