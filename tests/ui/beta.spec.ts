import { test, expect, type Page } from "@playwright/test";

async function becomeReady(client: Page, target: string) {
  const acknowledged = client.waitForResponse(
    (response) =>
      response.url().endsWith(`/v1/game-ready/${target}`) &&
      response.request().method() === "POST" &&
      response.request().postDataJSON()?.enabled === true,
  );
  await client
    .getByRole("button", { name: "I’m Ready to play", exact: true })
    .click();
  const response = await acknowledged;
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).self).toBe(true);
  await expect(
    client.getByRole("button", { name: "Stop being ready", exact: true }),
  ).toBeVisible();
}

test("two matches explicitly become ready, invite, accept and reveal a live game", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  // This test has its own setup because it needs two independent sessions.
  const second = await browser.newContext({
    viewport: { width: 412, height: 915 },
  });
  const guest = await second.newPage();
  await guest.route("**/v1/state", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), features: { gamesV2: false } },
    });
  });
  try {
    // Preserve the seeded Aarav/Anaya Games 2.0 invitation. Rohan/Nisha are
    // mutually matched and have no open game in the restored demo baseline.
    await page
      .getByRole("button", { name: "Switch demo user", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Enter as Rohan", exact: true })
      .click();
    await expect(
      page.getByText("DEMO MODE · Rohan", { exact: true }).last(),
    ).toBeVisible();
    await guest.goto("http://localhost:8081/");
    await guest.getByRole("button", { name: "Women", exact: true }).click();
    await guest
      .getByRole("button", { name: "Enter as Nisha", exact: true })
      .click();
    await expect(
      guest.getByRole("tab", { name: "Discover", exact: false }),
    ).toBeVisible();
    for (const [client, name, target] of [
      [page, "Nisha", "10000000-0000-4000-8000-000000000005"],
      [guest, "Rohan", "10000000-0000-4000-8000-000000000004"],
    ] as const) {
      await test.step(`Open games and explicitly mark ready with ${name}`, async () => {
        await client.getByRole("tab", { name: "Chat", exact: false }).click();
        await client
          .getByRole("button", { name: `Chat with ${name}`, exact: true })
          .click();
        await client
          .getByLabel("Conversation actions", { exact: true })
          .click();
        await client
          .getByRole("button", { name: "Play together", exact: true })
          .last()
          .click();
        await becomeReady(client, target);
      });
    }
    const invite = page.getByRole("button", {
      name: "Invite to This or that",
      exact: true,
    });
    await expect(invite).toBeEnabled({ timeout: 20000 });
    await invite.click();
    await expect(
      page.getByText("Your invitation is waiting", { exact: true }),
    ).toBeVisible();
    await guest
      .getByRole("button", { name: "Close sheet", exact: true })
      .click();
    await guest
      .getByRole("button", { name: "This or that · invited", exact: true })
      .click();
    await becomeReady(guest, "10000000-0000-4000-8000-000000000004");
    await expect(
      guest.getByRole("button", { name: "Accept invitation", exact: true }),
    ).toBeEnabled();
    await guest
      .getByRole("button", { name: "Accept invitation", exact: true })
      .click();
    await expect(
      page.getByText("Your ideal Sunday?", { exact: true }),
    ).toBeVisible({ timeout: 10000 });
    const options = [
      "Slow coffee",
      "Momos & a walk",
      "Mountain cabin",
      "Quality time",
      "Live music",
    ];
    for (const [index, option] of options.entries()) {
      await page.getByRole("button", { name: option, exact: true }).click();
      await page
        .getByRole("button", {
          name:
            index === options.length - 1
              ? "Review my choices"
              : "Next question",
          exact: true,
        })
        .click();
    }
    await page
      .getByRole("button", { name: "Lock in my choices", exact: true })
      .click();
    await expect(guest.getByText("Your match ✓", { exact: true })).toHaveCount(
      0,
    );
    for (const [index, option] of options.entries()) {
      await guest.getByRole("button", { name: option, exact: true }).click();
      await guest
        .getByRole("button", {
          name:
            index === options.length - 1
              ? "Review my choices"
              : "Next question",
          exact: true,
        })
        .click();
    }
    await guest
      .getByRole("button", { name: "Lock in my choices", exact: true })
      .click();
    await expect(
      page.getByText("A little more to talk about.", { exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      guest.getByText("A little more to talk about.", { exact: true }),
    ).toBeVisible();
  } finally {
    const cancel = page.getByRole("button", {
      name: "Cancel game",
      exact: true,
    });
    // Best-effort cleanup must not replace the original failed locator after a
    // timeout has already closed either session.
    if (!page.isClosed() && (await cancel.isVisible().catch(() => false)))
      await cancel.click({ timeout: 5000 }).catch(() => {});
    await second.close().catch(() => {});
  }
});

test.beforeEach(async ({ page }) => {
  // Exercise the preserved legacy rollout path; Games 2.0 has its own suite.
  await page.route("**/v1/state", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), features: { gamesV2: false } },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Enter as Aarav", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Discover", exact: false }),
  ).toBeVisible();
});

test("four core areas, Discover landing and Chat-owned stories", async ({
  page,
}) => {
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(
    page.getByRole("tab", { name: "Discover", exact: false }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Sangai", exact: false }).click();
  await expect(page.getByLabel("Add your story")).toHaveCount(0);
  await page.getByRole("tab", { name: "Chat", exact: false }).click();
  await expect(page.getByLabel("Add your story")).toBeVisible();
  await page
    .getByRole("button", { name: "Chat with Anaya", exact: true })
    .click();
  await expect(page.getByLabel("Chat camera", { exact: true })).toBeVisible();
  await page.getByLabel("Conversation actions", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play together", exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Plan a Date", exact: true }),
  ).toBeVisible();
  const message = "A hello from the redesigned chat " + Date.now();
  await page.getByLabel("Close sheet", { exact: true }).click();
  await page.getByPlaceholder("A thought, a question, a hello…").fill(message);
  await page.getByLabel("Send message", { exact: true }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByText(message, { exact: true })).toBeInViewport();
});

test("Sangai post composer offers gallery media and persists a private post", async ({
  page,
  request,
}) => {
  await page.getByRole("tab", { name: "Sangai", exact: false }).click();
  await page
    .getByRole("button", { name: "Create Post", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Choose photos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose a short video", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Camera", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record a video", exact: false }),
  ).toHaveCount(0);
  const marker = "A shared moment from the redesign " + Date.now();
  await page.getByLabel("What’s on your mind?", { exact: true }).fill(marker);
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/v1/posts") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const response = await created;
  const postId = (await response.json()).id;
  const authorization = await response.request().headerValue("Authorization");
  try {
    await expect(page.getByText(marker, { exact: true })).toBeVisible();
  } finally {
    if (authorization)
      await request.delete(`http://localhost:4100/v1/posts/${postId}`, {
        headers: { Authorization: authorization },
        data: {},
      });
  }
});

test("approved regional annual prices remain a display-only subscription preview", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /checkout|purchase|entitlement|billing|subscription/.test(request.url())
    )
      mutations.push(request.url());
  });
  await page.getByRole("tab", { name: "Profile", exact: false }).click();
  await page
    .getByRole("button", { name: "Explore Sangai plans", exact: true })
    .click();
  await expect(page.getByText("NPR 299.00", { exact: true })).toBeVisible();
  await page.getByText("Annual · save 20%", { exact: true }).click();
  await expect(page.getByText("NPR 2,870.40", { exact: true })).toBeVisible();
  await page.getByText("Australia", { exact: true }).click();
  await expect(page.getByLabel("Proposed price")).toHaveText("AUD 76.70");
  await page
    .getByRole("button", { name: "Preview Sangai Plus", exact: true })
    .click();
  await expect(
    page.getByText("Purchases are coming later", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your beta account remains Free.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Selected plan price")).toHaveText("AUD 76.70");
  expect(mutations).toEqual([]);
});
