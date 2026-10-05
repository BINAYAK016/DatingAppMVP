import { expect, test, type Page } from "@playwright/test";

async function restoreAccount(page: Page, active: () => boolean, demo = true) {
  await page.route("**/v1/auth/session", (route) =>
    route.fulfill(
      active()
        ? { json: { csrfToken: "synthetic-account-choice-csrf" } }
        : { status: 401, json: { message: "Please sign in." } },
    ),
  );
  await page.route("**/v1/state", (route) =>
    route.fulfill({
      json: {
        me: {
          id: "10000000-0000-4000-8000-000000000001",
          name: "Synthetic account choice fixture",
          demo,
          age: 28,
          city: "Kathmandu",
          intent: "Serious relationship",
          gender: "Man",
          bio: "Fictional browser regression fixture.",
          interests: [],
          languages: [],
          hobbies: [],
          lifestyle: {},
          media: [],
          email_verified_at: "2026-01-01T00:00:00Z",
          adult_declared_at: "2026-01-01T00:00:00Z",
          onboarded_at: "2026-01-01T00:00:00Z",
          preferences: { cities: [], genders: [], minAge: 18, maxAge: 80 },
        },
        discover: [],
        matches: [],
        stories: [],
        feed: [],
        notifications: [],
        games: [],
        undoId: null,
      },
    }),
  );
}

// Every API request is intercepted. This checks the entry routes without
// creating real accounts or changing the shared demo database.
test.beforeEach(async ({ page }) => {
  await page.route("**/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/auth/session")
      return route.fulfill({
        status: 401,
        json: { message: "Please sign in." },
      });
    if (path === "/v1/demo/config")
      return route.fulfill({
        json: {
          enabled: true,
          version: 1,
          groups: { men: 10, women: 10, lgbtq: 10 },
        },
      });
    if (path === "/v1/demo/users")
      return route.fulfill({ json: { items: [], nextCursor: null } });
    if (path === "/v1/auth/config")
      return route.fulfill({
        json: { google: false, localMail: false, otpConfigured: true },
      });
    return route.fulfill({
      status: 404,
      json: { message: "No fixture for this action." },
    });
  });
});

test("demo entry keeps email signup and login accessible without a redirect loop", async ({
  page,
}) => {
  await page.goto("/welcome");
  await expect(
    page.getByText("Choose a profile", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Demo accounts are shared/)).toBeVisible();
  await page
    .getByRole("button", { name: "Use my own account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/welcome\?account=1$/);
  await page
    .getByRole("button", { name: "Continue with email", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Already a member? Log in", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await expect(
    page.getByText("Choose a profile", { exact: true }),
  ).toBeVisible();
});

test("the explicit own-account route remains available after a refresh", async ({
  page,
}) => {
  await page.goto("/welcome?account=1");
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Choose a profile", { exact: true })).toHaveCount(
    0,
  );
});

test("desktop testers can move between demo and ordinary-account entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use my own account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await expect(
    page.getByText("Choose a profile", { exact: true }),
  ).toBeVisible();
});

test("disabled demo mode retains ordinary signup and rejects the demo selector", async ({
  page,
}) => {
  await page.route("**/v1/demo/config", (route) =>
    route.fulfill({
      json: {
        enabled: false,
        version: 1,
        groups: { men: 10, women: 10, lgbtq: 10 },
      },
    }),
  );
  await page.goto("/welcome?account=1");
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Explore demo accounts", exact: true }),
  ).toHaveCount(0);
  await page.goto("/demo");
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
});

test("an active demo session can open own-account entry only after logout succeeds", async ({
  page,
}) => {
  let active = true;
  let releaseLogout!: () => void;
  const logoutGate = new Promise<void>((resolve) => {
    releaseLogout = resolve;
  });
  await restoreAccount(page, () => active);
  await page.route("**/v1/logout", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-sangai-client"]).toBe("web");
    expect(route.request().headers()["x-csrf-token"]).toBe(
      "synthetic-account-choice-csrf",
    );
    await logoutGate;
    active = false;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/demo");
  const button = page.getByRole("button", {
    name: "Use my own account",
    exact: true,
  });
  await expect(button).toBeVisible();
  await button.click();
  try {
    await expect(
      page.getByRole("button", { name: "Opening your account…", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Men", exact: true }),
    ).toBeDisabled();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(
      page.getByRole("button", { name: "Continue with email", exact: true }),
    ).toHaveCount(0);
  } finally {
    releaseLogout();
  }
  await expect(page).toHaveURL(/\/welcome\?account=1$/);
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
});

test("failed demo logout keeps the session and allows an own-account retry", async ({
  page,
}) => {
  let active = true;
  let attempts = 0;
  await restoreAccount(page, () => active);
  await page.route("**/v1/logout", async (route) => {
    if (++attempts === 1)
      return route.fulfill({
        status: 503,
        json: { message: "Synthetic logout outage" },
      });
    active = false;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Use my own account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use my own account", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", {
      name: "Return to current demo account",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Return to current demo account",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use my own account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/welcome\?account=1$/);
  expect(attempts).toBe(2);
});

test("an ordinary account can return from the demo picker without logging out", async ({
  page,
}) => {
  await restoreAccount(page, () => true, false);
  let logoutRequests = 0;
  await page.route("**/v1/logout", (route) => {
    logoutRequests++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Return to my account", exact: true })
    .click();
  await expect(page.getByRole("tab", { name: /Discover/ })).toBeVisible();
  expect(logoutRequests).toBe(0);
});
