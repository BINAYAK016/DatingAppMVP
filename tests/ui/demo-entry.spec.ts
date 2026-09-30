import { expect, test } from "@playwright/test";

test("signup can reach demo accounts after the first request fails", async ({
  page,
}) => {
  let demoRequests = 0;
  await page.route("**/v1/auth/demo", async (route) => {
    if (route.request().method() === "GET" && demoRequests++ === 0) {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page.getByText("Make yourself at home")).toBeVisible();
  await page.getByRole("button", { name: "Explore demo accounts" }).click();
  await expect(page.getByText("Choose a demo account")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try Aarav demo account" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try Aarav demo account" }).click();
  await expect(page.getByText("Discover", { exact: true }).first()).toBeVisible();
});
