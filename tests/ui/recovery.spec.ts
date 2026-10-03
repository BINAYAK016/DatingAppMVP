import { expect, test, type Page } from "@playwright/test";

async function openDemoChat(page: Page) {
  await page.goto("/");
  const state = page.waitForResponse(
    (r) => r.url().endsWith("/v1/state") && r.ok(),
  );
  await page
    .getByRole("button", { name: "Enter as Aarav", exact: true })
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

const historyPositionJourney =
  "refresh preserves an older conversation position and explicit Send reveals the new message after layout growth";
test(historyPositionJourney, async ({ page }) => {
  await checkHistoryPosition(page);
});
test(`${historyPositionJourney} with a slower CPU`, async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "CPU throttling uses Chromium DevTools.",
  );
  const cpu = await page.context().newCDPSession(page);
  await cpu.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await checkHistoryPosition(page, 12000);
});
async function checkHistoryPosition(page: Page, refreshTimeout = 5000) {
  const { data, person, open } = await openDemoChat(page);
  const remembered = Array.from(
    { length: 28 },
    (_, index) =>
      `Synthetic remembered moment ${index + 1}: we talked about our favourite places, a weekend walk and the little things that made us laugh together.`,
  );
  const timeline: any[] = remembered.map((body, index) => ({
    id: `synthetic-scroll-message-${index}`,
    type: "message",
    sender: index % 2 ? data.me.id : person.id,
    body,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  }));
  timeline.push({
    id: "synthetic-scroll-game",
    type: "game",
    version: 2,
    kind: "this-or-that",
    state: "complete",
    complete: true,
    definition: {
      title: "A completed game about small choices and the stories behind them",
      durationMinutes: "2–3",
    },
    created_at: "2026-01-01T01:00:00.000Z",
  });
  const newest = "Synthetic latest message before browsing older conversation";
  timeline.push({
    id: "synthetic-scroll-latest",
    type: "message",
    sender: person.id,
    body: newest,
    created_at: "2026-01-01T01:01:00.000Z",
  });
  const sent: { body: string; clientId: string }[] = [];
  let reads = 0;
  await page.route(`**/v1/chat/${person.id}`, async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      sent.push(payload);
      const message = {
        id: "synthetic-scroll-confirmed-send",
        type: "message",
        sender: data.me.id,
        body: payload.body,
        created_at: new Date().toISOString(),
      };
      timeline.push(message);
      return route.fulfill({ json: { id: message.id } });
    }
    reads++;
    await route.fulfill({
      json: { person, games: [], hasMore: false, timeline },
    });
  });
  await open();
  await expect(page.getByText(newest, { exact: true })).toBeInViewport();

  // Browse with actual wheel input so the application sees the user's intent
  // to read history. No test scrolling is performed after the later Send.
  await page.mouse.move(200, 450);
  await page.mouse.wheel(0, -1600);
  await expect(page.getByText(newest, { exact: true })).not.toBeInViewport();
  let olderBody: string | undefined;
  for (const body of remembered.slice(0, -6)) {
    const box = await page.getByText(body, { exact: true }).boundingBox();
    if (box && box.y > 150 && box.y + box.height < 800) {
      olderBody = body;
      break;
    }
  }
  expect(
    olderBody,
    "an older message is fully in the conversation viewport",
  ).toBeTruthy();
  const older = page.getByText(olderBody!, { exact: true });
  const beforeRefresh = await older.boundingBox();
  const readBeforeRefresh = reads;
  timeline.push({
    id: "synthetic-scroll-incoming",
    type: "message",
    sender: person.id,
    body: "Synthetic incoming message received while you are reading history",
    created_at: "2026-01-01T01:02:00.000Z",
  });
  // Sixfold CPU throttling can delay the three-second poll and its response;
  // the initial visibility and preserved-position assertions stay unchanged.
  await expect
    .poll(() => reads, { timeout: refreshTimeout })
    .toBeGreaterThan(readBeforeRefresh);
  await expect(
    page.getByText(
      "Synthetic incoming message received while you are reading history",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(older).toBeInViewport();
  const afterRefresh = await older.boundingBox();
  expect(Math.abs(afterRefresh!.y - beforeRefresh!.y)).toBeLessThan(4);

  const message =
    "Synthetic reply after reading older messages. " +
    "I remembered our long walk and the stories we shared. " +
    "Here is another thought that takes several lines in the conversation. " +
    "The completed game above this reply also takes room on a small screen. " +
    "This last line must appear without manually scrolling after Send.";
  await page.getByPlaceholder("A thought, a question, a hello…").fill(message);
  await page.getByLabel("Send message", { exact: true }).click();
  await expect(page.getByText(message, { exact: true })).toBeInViewport();
  expect(sent).toHaveLength(1);
  expect(sent[0].body).toBe(message);
  expect(sent[0].clientId).toEqual(expect.any(String));
}

test("access revoked during Send clears private data and rejects a delayed authorized refresh", async ({
  page,
}) => {
  const { data, person, open } = await openDemoChat(page);
  let reads = 0;
  let release!: () => void;
  let releaseAuthorized!: () => void;
  const laterReads = new Promise<void>((resolve) => {
    release = resolve;
  });
  const delayedAuthorizedRead = new Promise<void>((resolve) => {
    releaseAuthorized = resolve;
  });
  const authorizedSnapshot = {
    person,
    games: [],
    hasMore: false,
    timeline: [
      {
        id: "synthetic-send-private-message",
        type: "message",
        sender: data.me.id,
        body: "Synthetic private conversation authorized before Send",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
  const sent: { body: string; clientId: string }[] = [];
  await page.route(`**/v1/chat/${person.id}`, async (route) => {
    if (route.request().method() === "POST") {
      sent.push(route.request().postDataJSON());
      return route.fulfill({
        status: 403,
        json: { message: "Synthetic access revoked during Send" },
      });
    }
    if (++reads > 2) {
      // A later poll cannot provide the revocation response needed to clear
      // the UI. The Send response must enforce that loss of access itself.
      await laterReads;
      return route.abort();
    }
    if (reads === 2) await delayedAuthorizedRead;
    await route.fulfill({ json: authorizedSnapshot });
  });
  try {
    await open();
    const privateMessage = page.getByText(
      "Synthetic private conversation authorized before Send",
      { exact: true },
    );
    await expect(privateMessage).toBeVisible();
    const draft = page.getByPlaceholder("A thought, a question, a hello…");
    await draft.fill("Synthetic draft rejected when access was revoked");
    // Start an authorized poll before access changes, but delay its response.
    await expect.poll(() => reads).toBe(2);
    const rejection = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/v1/chat/${person.id}`) &&
        response.request().method() === "POST" &&
        response.status() === 403,
    );
    await page.getByLabel("Send message", { exact: true }).click();
    await rejection;
    await expect(privateMessage).toHaveCount(0, { timeout: 1500 });
    await expect(draft).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Play together", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/your draft is still here/i)).toHaveCount(0);

    const lateResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/v1/chat/${person.id}`) &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    releaseAuthorized();
    await lateResponse;
    // Wait until the sequential poll has consumed that old response. The next
    // read stays held, so it cannot conceal an unauthorized resurrection.
    await expect.poll(() => reads, { timeout: 10000 }).toBe(3);
    await expect(privateMessage).toHaveCount(0);
    await expect(draft).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Play together", exact: true }),
    ).toHaveCount(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toBe(
      "Synthetic draft rejected when access was revoked",
    );
  } finally {
    releaseAuthorized();
    release();
  }
});

test("changing reduced motion during a new message entrance keeps its text readable and fully opaque", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const { data, person, open } = await openDemoChat(page);
  const timeline: any[] = [
    {
      id: "synthetic-motion-existing",
      type: "message",
      sender: person.id,
      body: "Synthetic conversation before changing motion preferences",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  let sends = 0;
  const currentTime = new Date();
  await page.route(`**/v1/chat/${person.id}`, async (route) => {
    if (route.request().method() === "POST") {
      sends++;
      const payload = route.request().postDataJSON();
      const id = "synthetic-motion-confirmed-message";
      timeline.push({
        id,
        type: "message",
        sender: data.me.id,
        body: payload.body,
        created_at: currentTime.toISOString(),
      });
      return route.fulfill({ json: { id } });
    }
    await route.fulfill({
      json: { person, games: [], hasMore: false, timeline },
    });
  });
  await open();
  await expect(
    page.getByText(
      "Synthetic conversation before changing motion preferences",
      { exact: true },
    ),
  ).toBeVisible();
  // Freeze Date only, keeping browser frames and media-query events running.
  // This holds the short entrance in progress until the preference changes,
  // rather than depending on the test machine beating a 180 ms animation.
  await page.clock.setFixedTime(currentTime);
  const message =
    "Synthetic new message must remain readable when motion changes";
  await page.getByPlaceholder("A thought, a question, a hello…").fill(message);
  await page.getByLabel("Send message", { exact: true }).click();
  const text = page.getByText(message, { exact: true });
  await expect(text).toBeInViewport();
  const effectiveOpacity = () =>
    text.evaluate((node) => {
      let opacity = 1;
      for (
        let element: Element | null = node;
        element;
        element = element.parentElement
      )
        opacity *= Number(getComputedStyle(element).opacity);
      return Number(opacity.toFixed(3));
    });
  await expect.poll(effectiveOpacity).toBeLessThan(1);
  expect(await effectiveOpacity()).toBeGreaterThanOrEqual(0.7);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    )
    .toBe(true);
  await expect.poll(effectiveOpacity).toBe(1);
  await expect(text).toBeInViewport();
  expect(sends).toBe(1);
});
