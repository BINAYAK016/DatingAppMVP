import { test, expect } from "@playwright/test";
import sharp from "../../apps/api/node_modules/sharp";
test("email signup verifies through local mail and saves all five onboarding steps", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const email = `ui-${Date.now()}@example.test`;
  let token = "";
  page.on("response", async (response) => {
    if (response.url().endsWith("/v1/auth/register") && response.ok()) {
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
    await page
      .getByRole("button", { name: "Send verification code", exact: true })
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
        code = detail.Text.match(/\b[a-f0-9]{24}\b/)?.[0] || "";
        return !!code;
      })
      .toBe(true);
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
    await page.getByRole("button", { name: "Library", exact: true }).click();
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
      page.getByText("You’re all caught up", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("FICTIONAL DEMO PROFILE", { exact: true }),
    ).toHaveCount(0);
  } finally {
    if (token)
      await request.delete("http://localhost:4100/v1/account", {
        headers: { Authorization: `Bearer ${token}` },
        data: { confirm: "DELETE" },
      });
  }
});
