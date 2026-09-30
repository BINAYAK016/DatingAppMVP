import { test, expect } from "@playwright/test";

test("a card drag records a Pass, Undo restores it, and a tap opens its profile", async ({
  page,
  request,
}) => {
  const accounts = await (
    await request.get("http://localhost:4100/v1/auth/demo")
  ).json();
  let accountName = "";
  for (const account of accounts) {
    const session = await (
      await request.post("http://localhost:4100/v1/auth/demo", {
        data: { id: account.id },
      })
    ).json();
    const state = await (
      await request.get("http://localhost:4100/v1/state", {
        headers: { Authorization: `Bearer ${session.token}` },
      })
    ).json();
    if (state.discover?.length) {
      accountName = account.name;
      break;
    }
  }
  expect(
    accountName,
    "A fictional demo needs an eligible card for this reversible gesture journey",
  ).not.toBe("");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: `Try ${accountName} demo account`,
      exact: true,
    })
    .click();
  const card = page
    .getByRole("button", { name: /^View .+'s profile$/ })
    .first();
  await expect(card).toBeVisible();
  const label = await card.getAttribute("aria-label");
  const initial = page.getByRole("button", { name: label!, exact: true });
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.35, {
    steps: 15,
  });
  await page.mouse.up();
  await expect(initial).toHaveCount(0);
  await page
    .getByRole("button", { name: "Undo last decision", exact: true })
    .click();
  await expect(initial).toBeVisible();
  await initial.click();
  await expect(page).toHaveURL(/\/profile\//);
  await expect(
    page.getByRole("button", { name: "Go back", exact: true }),
  ).toBeVisible();
});
