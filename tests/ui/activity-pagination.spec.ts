import { expect, test, type Page } from "@playwright/test";

const before = "2026-10-01T10:20:30.123456Z";
const beforeId = "00000000-0000-4000-8000-000000000002";
const gameId = "00000000-0000-4000-8000-000000000010";
const first = {
  id: "synthetic-newest",
  kind: "game",
  body: "Synthetic newest update",
  read: false,
  created_at: "2026-10-01T10:20:30.124Z",
  resource_type: "game",
  resource_id: gameId,
};
const overlap = {
  id: beforeId,
  kind: "message",
  body: "Synthetic overlapping update",
  read: false,
  created_at: "2026-10-01T10:20:30.123Z",
};
const oldest = {
  id: "synthetic-oldest",
  kind: "message",
  body: "Synthetic older update",
  read: false,
  created_at: "2026-10-01T10:20:29Z",
};
const head = {
  items: [first, overlap],
  hasMore: true,
  nextCursor: { before, beforeId },
};

async function openActivity(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Try Aarav demo account", exact: true })
    .click();
  await page.getByRole("tab", { name: "Chat", exact: false }).click();
  await page
    .getByRole("button", { name: "Open activity", exact: true })
    .click();
  await expect(page.getByText(first.body, { exact: true })).toBeVisible();
}

test("Activity preserves exact cursors, dedupes older pages and keeps game navigation and read-all", async ({
  page,
}) => {
  let olderReads = 0,
    writes = 0;
  await page.route("**/v1/notifications?*", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get("limit")).toBe("30");
    if (query.has("before")) {
      olderReads++;
      expect(query.get("before")).toBe(before);
      expect(query.get("beforeId")).toBe(beforeId);
      await route.fulfill({
        json: {
          items: [{ ...overlap, body: "Synthetic overlap refreshed" }, oldest],
          hasMore: false,
          nextCursor: null,
        },
      });
    } else await route.fulfill({ json: head });
  });
  await page.route("**/v1/notifications/read", async (route) => {
    writes++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({});
    await route.fulfill({ status: 201, json: { ok: true } });
  });
  await page.route(`**/v1/game/${gameId}`, (route) =>
    route.fulfill({
      status: 404,
      json: { message: "Synthetic unavailable game" },
    }),
  );
  await openActivity(page);
  await page
    .getByRole("button", { name: "Older updates", exact: true })
    .click();
  await expect(page.getByText(oldest.body, { exact: true })).toBeVisible();
  await expect(
    page.getByText("Synthetic overlap refreshed", { exact: true }),
  ).toHaveCount(1);
  await expect(page.getByText(overlap.body, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Older updates", exact: true }),
  ).toHaveCount(0);
  expect(olderReads).toBe(1);
  await page
    .getByRole("button", { name: "Mark updates as read", exact: true })
    .click();
  await expect(page.getByLabel("Unread update", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText(oldest.body, { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "Open game", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/game/${gameId}\\?version=2$`));
});

test("Activity retains loaded updates during temporary page failure and clears them on access denial", async ({
  page,
}) => {
  let status = 503;
  await page.route("**/v1/notifications?*", (route) => {
    const query = new URL(route.request().url()).searchParams;
    return query.has("before")
      ? route.fulfill({ status, json: { message: "Synthetic read failure" } })
      : route.fulfill({ json: head });
  });
  await openActivity(page);
  await page
    .getByRole("button", { name: "Older updates", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry updates", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(first.body, { exact: true })).toBeVisible();
  await expect(page.getByText(overlap.body, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Retry updates", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry updates", exact: true }),
  ).toHaveCount(0);
  status = 403;
  await page
    .getByRole("button", { name: "Older updates", exact: true })
    .click();
  await expect(
    page.getByText("Your updates are unavailable. Please sign in again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(first.body, { exact: true })).toHaveCount(0);
  await expect(page.getByText(overlap.body, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Older updates", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open game", exact: true }),
  ).toHaveCount(0);
});
