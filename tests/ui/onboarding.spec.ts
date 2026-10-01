import { test, expect } from "@playwright/test";
import sharp from "../../apps/api/node_modules/sharp";
test("email signup verifies through local mail and saves all five onboarding steps", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  page.on("pageerror", (error) =>
    console.error("Auth browser error:", error.message),
  );
  const email = `ui-${Date.now()}@example.test`;
  let token = "";
  page.on("response", async (response) => {
    if (/\/v1\/auth\/(register|login)$/.test(response.url()) && response.ok()) {
      token = (await response.json()).token;
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
    await page
      .getByRole("button", { name: "Save & continue", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save & continue", exact: true })
      .click();
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
        fetch("http://localhost:4100/v1/account", {
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
        const session = await fetch("http://localhost:4100/v1/auth/login", {
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
