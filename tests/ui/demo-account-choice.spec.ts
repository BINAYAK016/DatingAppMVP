import { expect, test } from "@playwright/test";

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
