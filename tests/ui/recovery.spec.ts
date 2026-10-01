import { expect, test, type Page } from "@playwright/test";

async function openDemoChat(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  const state = page.waitForResponse(
    (r) => r.url().endsWith("/v1/state") && r.ok(),
  );
  await page
    .getByRole("button", { name: "Try Aarav demo account", exact: true })
    .click();
  const data = await (await state).json();
  const person = data.matches.find((p: any) => p.name === "Anaya");
  return {
    data,
    person,
    open: async () => {
      await page.getByRole("tab", { name: "Chat", exact: false }).click();
      await page
        .getByRole("button", { name: "Chat with Anaya", exact: true })
        .click();
    },
  };
}

test("transient chat failures retain conversation and draft, access revocation clears both media and timeline", async ({
  page,
}) => {
  const { data, person, open } = await openDemoChat(page);
  let mode: "ok" | "temporary" | "revoked" = "ok";
  await page.route(`**/v1/chat/${person.id}`, (route) =>
    route.fulfill({
      status: mode === "temporary" ? 503 : mode === "revoked" ? 404 : 200,
      json:
        mode === "ok"
          ? {
              person,
              games: [],
              hasMore: false,
              timeline: [
                {
                  id: "synthetic-recovery",
                  type: "message",
                  sender: data.me.id,
                  body: "Synthetic retained conversation",
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : { message: "Synthetic connection failure" },
    }),
  );
  await open();
  await expect(
    page.getByText("Synthetic retained conversation", { exact: true }),
  ).toBeVisible();
  const draft = page.getByRole("textbox", {
    name: "A thought, a question, a hello…",
    exact: true,
  });
  await draft.fill("Synthetic unsent draft");
  mode = "temporary";
  await expect(
    page.getByRole("button", { name: "Reconnect", exact: true }),
  ).toBeVisible({ timeout: 12000 });
  await expect(
    page.getByText("Synthetic retained conversation", { exact: true }),
  ).toBeVisible();
  await expect(draft).toHaveValue("Synthetic unsent draft");
  mode = "revoked";
  await expect(
    page.getByText("Synthetic retained conversation", { exact: true }),
  ).toHaveCount(0, { timeout: 12000 });
  await expect(draft).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Play together", exact: true }),
  ).toHaveCount(0);
});

test("a delayed history response cannot restore private messages after access is revoked", async ({
  page,
}) => {
  const { data, person, open } = await openDemoChat(page);
  let revoked = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/v1/chat/${person.id}*`, async (route) => {
    const earlier = new URL(route.request().url()).searchParams.has("before");
    if (earlier) {
      await pending;
      return route.fulfill({
        json: {
          hasMore: false,
          timeline: [
            {
              id: "synthetic-private-history",
              type: "message",
              sender: data.me.id,
              body: "Synthetic delayed private history",
              created_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      });
    }
    await route.fulfill({
      status: revoked ? 404 : 200,
      json: revoked
        ? { message: "Synthetic access revoked" }
        : {
            person,
            games: [],
            hasMore: true,
            timeline: [
              {
                id: "synthetic-current-history",
                type: "message",
                sender: data.me.id,
                body: "Synthetic current private message",
                created_at: "2026-01-02T00:00:00.000Z",
              },
            ],
          },
    });
  });
  await open();
  await expect(
    page.getByText("Synthetic current private message", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Earlier conversation", exact: true })
    .click();
  revoked = true;
  await expect(
    page.getByText("Synthetic current private message", { exact: true }),
  ).toHaveCount(0, { timeout: 12000 });
  const response = page.waitForResponse((r) =>
    r.url().includes(`/chat/${person.id}?before=`),
  );
  release();
  await response;
  await expect(
    page.getByText("Synthetic delayed private history", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", {
      name: "A thought, a question, a hello…",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("slow foreground polls share one GET instead of accumulating parallel requests", async ({
  page,
}) => {
  const { data, person, open } = await openDemoChat(page);
  let held = false,
    reads = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/v1/chat/${person.id}`, async (route) => {
    reads++;
    if (held) await pending;
    await route.fulfill({
      json: {
        person,
        games: [],
        hasMore: false,
        timeline: [
          {
            id: "synthetic-slow",
            type: "message",
            sender: data.me.id,
            body: "Synthetic slow network",
            created_at: new Date().toISOString(),
          },
        ],
      },
    });
  });
  await open();
  await expect(
    page.getByText("Synthetic slow network", { exact: true }),
  ).toBeVisible();
  held = true;
  const start = reads;
  await expect.poll(() => reads).toBe(start + 1);
  await page.waitForTimeout(6500);
  expect(reads).toBe(start + 1);
  release();
  await expect(
    page.getByText("Synthetic slow network", { exact: true }),
  ).toBeVisible();
});
