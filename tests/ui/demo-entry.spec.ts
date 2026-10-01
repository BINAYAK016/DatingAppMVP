import { expect, test } from "@playwright/test";

test("demo entry can retry the first profile request and enter without signup", async ({
  page,
}) => {
  let demoRequests = 0;
  await page.route("**/v1/demo/users?*", async (route) => {
    if (route.request().method() === "GET" && demoRequests++ === 0) {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto("/welcome");
  await expect(
    page.getByText("Choose a profile", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry loading demos", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Enter as Aarav", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enter as Aarav", exact: true })
    .click();
  await expect(
    page.getByText("Discover", { exact: true }).first(),
  ).toBeVisible();
});
