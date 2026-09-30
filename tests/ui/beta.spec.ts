import { test, expect } from "@playwright/test";

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
  try {
    await guest.goto("http://localhost:8081/");
    await guest
      .getByRole("button", { name: "Explore demo accounts", exact: true })
      .click();
    await guest.getByText("Anaya", { exact: true }).click();
    for (const [client, name] of [
      [page, "Anaya"],
      [guest, "Aarav"],
    ] as const) {
      await client.getByRole("tab", { name: "Chat", exact: false }).click();
      await client
        .getByRole("button", { name: `Chat with ${name}`, exact: true })
        .click();
      await client.getByLabel("Conversation actions", { exact: true }).click();
      await client
        .getByRole("button", { name: "Dating games", exact: true })
        .click();
      await client
        .getByRole("button", { name: "I’m Ready to play", exact: true })
        .click();
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
    await guest.getByRole("button", { name: "Go back", exact: true }).click();
    await guest
      .getByRole("button", { name: "This or that · invited", exact: true })
      .click();
    await guest
      .getByRole("button", { name: "I’m Ready to play", exact: true })
      .click();
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
    if (await cancel.isVisible()) await cancel.click();
    await second.close();
  }
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await page.getByText("Aarav", { exact: true }).click();
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
    page.getByRole("button", { name: "Dating games", exact: true }),
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

test("Sangai post composer uses the library and persists a private post", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Sangai", exact: false }).click();
  await page.getByLabel("Create a Sangai post").click();
  await expect(
    page.getByRole("button", { name: "Library", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Camera", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record a video", exact: false }),
  ).toHaveCount(0);
  const marker = "A shared moment from the redesign " + Date.now();
  await page
    .getByPlaceholder("The little things make the best stories…")
    .fill(marker);
  await page
    .getByRole("button", { name: "Share with my matches", exact: true })
    .click();
  await expect(page.getByText(marker, { exact: true })).toBeVisible();
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
