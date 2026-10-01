import { expect, test } from "@playwright/test";

test("successful authentication with an unavailable state request has explicit retry recovery", async ({
  page,
}) => {
  let offline = true;
  await page.route("**/v1/state", async (route) => {
    if (offline) await route.abort();
    else await route.continue();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Try Aarav demo account", exact: true })
    .click();
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
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Try Aarav demo account", exact: true })
    .click();
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page.getByLabel("Profile settings", { exact: true }).click();
  const loggedOut = page.waitForResponse((response) =>
    response.url().endsWith("/v1/logout"),
  );
  await page
    .getByRole("button", {
      name: "Switch demo account / sign out",
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
