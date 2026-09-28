import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Aarav", { exact: true }).click();
  await expect(page.getByText("Better, together.")).toBeVisible();
});
test("private feed, composer and persistent post", async ({ page }) => {
  const marker = "A small joy from the UI test " + Date.now();
  await page.getByText("A moment worth sharing?").click();
  await page
    .getByPlaceholder("The little things make the best stories…")
    .fill(marker);
  await page
    .getByRole("button", { name: "Share with my matches", exact: true })
    .click();
  await expect(page.getByText(marker, { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/feed.png" });
});
test("discovery, community discussion, and event form", async ({ page }) => {
  await page.getByRole("tab", { name: "Discover", exact: false }).click();
  await expect(
    page.getByText("A little spark.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/discover.png" });
  await page.getByRole("tab", { name: "Circles", exact: false }).click();
  await page.getByText("The weekend people", { exact: true }).click();
  await expect(
    page.getByText("EVERYONE HERE IS A MUTUAL MATCH", { exact: true }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Start a conversation in your circle…")
    .fill("Looking forward to our next coffee walk.");
  await page
    .getByRole("button", { name: "Post to circle", exact: true })
    .click();
  await expect(
    page
      .getByText("Looking forward to our next coffee walk.", { exact: true })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Plan a circle event", exact: true })
    .click();
  await expect(page.getByText("Bring your circle together.")).toBeVisible();
});
test("dating game answers and chat delivery", async ({ page }) => {
  await page.getByRole("tab", { name: "Play", exact: false }).click();
  await page
    .getByRole("button", { name: "Play with Anaya", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Invite to play", exact: true })
    .first()
    .click();
  await expect(page.getByText("QUESTION 1 / 5")).toBeVisible();
  for (const option of [
    "Slow coffee",
    "Momos & a walk",
    "Mountain cabin",
    "Quality time",
    "Live music",
  ])
    await page.getByText(option, { exact: true }).click();
  await page
    .getByRole("button", { name: "Lock in my choices", exact: true })
    .click();
  await expect(
    page.getByText(
      "Your choices are locked. Your match’s answers remain private until they play too.",
    ),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/game.png" });
  await page
    .getByLabel("Go back", { exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "Open connections", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Chat with Anaya", exact: true })
    .click();
  const message = "Hello from the UI test " + Date.now();
  await page.getByPlaceholder("A thought, a question, a hello…").fill(message);
  await page.getByLabel("Send message", { exact: true }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
});
