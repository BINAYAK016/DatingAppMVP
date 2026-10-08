import { TEST_API_ORIGIN, TEST_MAIL_ORIGIN } from "./test-environment";
import { test, expect } from "@playwright/test";
import sharp from "../../apps/api/node_modules/sharp";
test("email signup verifies through local mail and saves all five onboarding steps", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  // Preserve the actual Mailpit/account journey for the later auth phase while
  // the default local product now enters the separate fictional demo selector.
  await page.route("**/v1/demo/config", (route) =>
    route.fulfill({
      json: {
        enabled: false,
        version: 1,
        groups: { men: 10, women: 10, lgbtq: 10 },
      },
    }),
  );
  await page.setViewportSize({ width: 360, height: 640 });
  page.on("pageerror", (error) =>
    console.error("Auth browser error:", error.message),
  );
  const email = `ui-${Date.now()}@example.test`;
  let token = "";
  page.on("response", async (response) => {
    if (/\/v1\/auth\/(register|login)$/.test(response.url()) && response.ok()) {
      // Browser sign-in returns a CSRF handle; cleanup uses a separate native
      // login below when the original response intentionally has no bearer.
      token = (await response.json()).token || "browser-cleanup-required";
    }
  });
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Continue with email", exact: true })
      .click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password · at least 10 characters", { exact: true })
      .fill("a-ui-fixture-password");
    await page
      .getByText(
        "I am 18 or older and agree to the beta terms, privacy policy and community rules.",
        { exact: true },
      )
      .click();
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    let code = "";
    await expect
      .poll(async () => {
        const list = await (
          await request.get(TEST_MAIL_ORIGIN + "/api/v1/messages")
        ).json();
        const message = list.messages.find((m: any) =>
          m.To.some((to: any) => to.Address === email),
        );
        if (!message) return false;
        const detail = await (
          await request.get(`${TEST_MAIL_ORIGIN}/api/v1/message/${message.ID}`)
        ).json();
        code = detail.Text.match(/\b\d{6}\b/)?.[0] || "";
        return !!code;
      })
      .toBe(true);
    await expect(
      page.getByText("u***@example.test", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Resend in \d{2}:/ }),
    ).toBeDisabled();
    await page
      .getByLabel("Verification code", { exact: true })
      .fill(code === "000000" ? "000001" : "000000");
    await page
      .getByRole("button", { name: "Verify email", exact: true })
      .click();
    await expect(
      page.getByText("That code isn’t correct. Please try again.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Verification code", { exact: true }).fill(code);
    await page
      .getByRole("button", { name: "Verify email", exact: true })
      .click();
    await page.getByLabel("First name", { exact: true }).fill("Beta Tester");
    await page
      .getByLabel("Date of birth · YYYY-MM-DD", { exact: true })
      .fill("1997-03-10");
    await page.getByRole("button", { name: "Woman", exact: true }).click();
    await page
      .getByRole("button", {
        name: "I declare that I am at least 18",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Save & continue", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add profile photo", exact: true })
      .click();
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Choose a photo", exact: true })
      .click();
    await (
      await chooser
    ).setFiles({
      name: "fixture.png",
      mimeType: "image/png",
      buffer: await sharp({
        create: { width: 128, height: 128, channels: 3, background: "#FBE4EB" },
      })
        .png()
        .toBuffer(),
    });
    await page
      .getByRole("button", { name: "Use this photo", exact: true })
      .click();
    await page
      .getByLabel("A little about you", { exact: true })
      .fill("I enjoy coffee, art and a thoughtful conversation.");
    await page
      .getByRole("button", { name: "Save & continue", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Casual dating", exact: true })
      .click();
    await page.getByRole("button", { name: "Art", exact: true }).click();
    await test.step("a long step resets scroll on continue without losing the profile draft", async () => {
      await page
        .getByLabel("Languages · optional, comma separated", { exact: true })
        .fill("Nepali, English");
      const hobbies = page.getByLabel("Hobbies · optional, comma separated", {
        exact: true,
      });
      await hobbies.fill("Hiking, Coffee");
      const offset = await hobbies.evaluate((field) => {
        let parent = field.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          if (
            /auto|scroll/.test(style.overflowY) &&
            parent.scrollHeight > parent.clientHeight
          ) {
            parent.scrollTop = parent.scrollHeight;
            return parent.scrollTop;
          }
          parent = parent.parentElement;
        }
        throw new Error("Onboarding has no scrollable form container.");
      });
      expect(offset).toBeGreaterThan(200);
      await expect(
        page.getByText("What matters to you", { exact: true }),
      ).not.toBeInViewport();
      const interestsSaved = page.waitForRequest(
        (action) =>
          action.url().endsWith("/v1/onboarding") &&
          action.method() === "PATCH" &&
          action.postDataJSON().step === 2,
      );
      await page
        .getByRole("button", { name: "Save & continue", exact: true })
        .click();
      const savedDraft = (await interestsSaved).postDataJSON().data;
      await expect(
        page.getByText("STEP 4 OF 5", { exact: true }),
      ).toBeInViewport();
      await expect(
        page.getByText("Your preferences", { exact: true }),
      ).toBeInViewport();
      const preferencesSaved = page.waitForRequest(
        (action) =>
          action.url().endsWith("/v1/onboarding") &&
          action.method() === "PATCH" &&
          action.postDataJSON().step === 3,
      );
      await page
        .getByRole("button", { name: "Save & continue", exact: true })
        .click();
      expect((await preferencesSaved).postDataJSON().data).toEqual(savedDraft);
      expect(savedDraft).toMatchObject({
        name: "Beta Tester",
        bio: "I enjoy coffee, art and a thoughtful conversation.",
        intent: "Casual dating",
        interests: ["Art"],
        languages: ["Nepali", "English"],
        hobbies: ["Hiking", "Coffee"],
      });
      await expect(
        page.getByText("STEP 5 OF 5", { exact: true }),
      ).toBeInViewport();
    });
    await page
      .getByLabel("Your conversation starter", { exact: true })
      .fill("My ideal weekend includes a gallery and a long walk.");
    await page
      .getByRole("button", { name: "Finish profile & Discover", exact: true })
      .click();
    await expect(
      page.getByRole("tab", { name: "Discover", exact: false }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByText("FICTIONAL DEMO PROFILE", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Profile", exact: false }).click();
    await page.getByLabel("Profile settings", { exact: true }).click();
    await page.getByRole("button", { name: "Account", exact: true }).click();
    const loggedOut = page.waitForResponse(
      (response) => response.url().endsWith("/v1/logout"),
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    expect((await loggedOut).ok()).toBe(true);
    await expect(
      page.getByRole("button", { name: "Continue with email", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "I already have an account", exact: true })
      .click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password · at least 10 characters", { exact: true })
      .fill("a-ui-fixture-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("tab", { name: "Discover", exact: false }),
    ).toHaveAttribute("aria-selected", "true");
  } finally {
    if (token) {
      const cleanup = () =>
        fetch(TEST_API_ORIGIN + "/v1/account", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ confirm: "DELETE" }),
          signal: AbortSignal.timeout(5000),
        });
      const deleted = await cleanup();
      if (deleted.status === 401) {
        const session = await fetch(TEST_API_ORIGIN + "/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: "a-ui-fixture-password" }),
          signal: AbortSignal.timeout(5000),
        });
        if (session.ok) {
          token = (await session.json()).token;
          await cleanup();
        }
      }
    }
  }
});
