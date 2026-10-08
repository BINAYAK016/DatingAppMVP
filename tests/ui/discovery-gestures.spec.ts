import { expect, test, type Page } from "@playwright/test";
import { auditIds, installAuditFixture } from "./reform-audit.fixture";

test.use({ hasTouch: true, isMobile: true });

async function setup(page: Page) {
  const fixture = await installAuditFixture(page);
  fixture.reset();
  const decisions: { target: string; action: string; clientId: string }[] = [];
  await page.route("**/v1/discovery/*", async (route) => {
    decisions.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ matched: false }),
    });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("discovery-profile")).toBeVisible();
  return { fixture, decisions };
}

async function touchDrag(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [start],
    });
    for (let step = 1; step <= 12; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: start.x + ((end.x - start.x) * step) / 12,
            y: start.y + ((end.y - start.y) * step) / 12,
          },
        ],
      });
      // Pace the real touch stream so the browser/native responder can decide
      // between scrolling and dragging, rather than programmatically scrolling.
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await cdp.detach();
  }
}

async function enlargeText(page: Page) {
  await page.evaluate(() => {
    const text = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter(
        (element) =>
          !element.closest('[aria-hidden="true"]') &&
          [...element.childNodes].some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          ),
      )
      .map((element) => ({
        element,
        size: parseFloat(getComputedStyle(element).fontSize),
        line: parseFloat(getComputedStyle(element).lineHeight),
      }));
    for (const { element, size, line } of text) {
      if (Number.isFinite(size))
        element.style.setProperty("font-size", `${size * 2}px`, "important");
      if (Number.isFinite(line))
        element.style.setProperty("line-height", `${line * 2}px`, "important");
    }
  });
}

for (const scenario of ["200 percent text", "short viewport"]) {
  test(`Discover card yields vertical touch scrolling with ${scenario}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: 390,
      height: scenario === "short viewport" ? 460 : 844,
    });
    const { fixture, decisions } = await setup(page);
    if (scenario === "200 percent text") {
      const heading = page.getByRole("heading", {
        name: "Discover",
        exact: true,
      });
      const original = await heading.evaluate((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      );
      await enlargeText(page);
      await expect(heading).toHaveCSS("font-size", `${original * 2}px`);
    }
    const scroll = page.getByTestId("discovery-scroll");
    const card = page.getByTestId("discovery-profile");
    const action = page.getByRole("button", {
      name: "Super Like",
      exact: true,
    });
    await expect
      .poll(() =>
        scroll.evaluate(
          (element) => element.scrollHeight - element.clientHeight,
        ),
      )
      .toBeGreaterThan(100);
    await expect(action).not.toBeInViewport({ ratio: 1 });
    const initialTop = await scroll.evaluate((element) => element.scrollTop);
    for (let swipe = 0; swipe < 4; swipe++) {
      await expect(card).toBeVisible();
      const viewport = (await scroll.boundingBox())!;
      const control = (await action.boundingBox())!;
      if (
        control.y >= viewport.y &&
        control.y + control.height <= viewport.y + viewport.height
      )
        break;
      const box = (await card.boundingBox())!;
      const top = Math.max(box.y, viewport.y) + 20;
      const bottom =
        Math.min(box.y + box.height, viewport.y + viewport.height) - 20;
      expect(
        bottom - top,
        "A real part of the card must receive the vertical gesture",
      ).toBeGreaterThan(60);
      await touchDrag(
        page,
        { x: box.x + box.width / 2, y: bottom },
        { x: box.x + box.width / 2, y: top },
      );
      expect(
        decisions,
        "Scrolling must not send a Like, Pass or Super Like",
      ).toEqual([]);
    }
    await expect
      .poll(() => scroll.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(initialTop + 40);
    // A tap during touch-scroll deceleration intentionally stops the fling.
    // Wait for measured scroll position to settle before testing activation.
    await scroll.evaluate(
      (element) =>
        new Promise<void>((resolve, reject) => {
          let previous = element.scrollTop;
          let stableFrames = 0;
          const deadline = performance.now() + 3000;
          const frame = () => {
            const current = element.scrollTop;
            stableFrames =
              Math.abs(current - previous) < 0.1 ? stableFrames + 1 : 0;
            previous = current;
            if (stableFrames >= 10) resolve();
            else if (performance.now() > deadline)
              reject(new Error("Discovery scroll did not settle"));
            else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        }),
    );
    await expect(action).toBeInViewport({ ratio: 1 });
    await expect(action).toBeEnabled();
    expect(
      decisions,
      "Settled vertical scrolling must not send a decision",
    ).toEqual([]);
    // Gesture arbitration above uses real touch input. Use normal browser
    // pointer activation here; native touch-button reachability is checked
    // independently on Android, without relying on CDP's post-scroll click.
    await action.click();
    await expect
      .poll(() => decisions.map((item) => item.action))
      .toEqual(["super"]);
    expect(decisions[0].target).toBe(auditIds.candidate);
    expect(decisions[0].clientId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(fixture.current.unexpected).toEqual([]);
  });
}

test("overflow cards retain horizontal Like/Pass and a following profile tap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 460 });
  const { fixture, decisions } = await setup(page);
  const scroll = page.getByTestId("discovery-scroll");
  const card = page.getByTestId("discovery-profile");
  await expect
    .poll(() =>
      scroll.evaluate((element) => element.scrollHeight - element.clientHeight),
    )
    .toBeGreaterThan(100);
  for (const [direction, action] of [
    [-1, "pass"],
    [1, "like"],
  ] as const) {
    const box = (await card.boundingBox())!;
    const viewport = (await scroll.boundingBox())!;
    const y =
      (Math.max(box.y, viewport.y) +
        Math.min(box.y + box.height, viewport.y + viewport.height)) /
      2;
    const from = direction === -1 ? 0.8 : 0.2;
    const to = direction === -1 ? 0.2 : 0.8;

    await touchDrag(
      page,
      { x: box.x + box.width * from, y },
      { x: box.x + box.width * to, y },
    );
    await expect.poll(() => decisions.at(-1)?.action).toBe(action);
    await expect(
      page.getByRole("button", { name: "Like", exact: true }),
    ).toBeEnabled();
    await expect
      .poll(() =>
        card.evaluate(
          (element) => getComputedStyle(element.parentElement!).transform,
        ),
      )
      .toBe("matrix(1, 0, 0, 1, 0, 0)");
    // A completed request is earlier than the touch-release/render cycle.
    // Wait for the settled card to paint before starting a second gesture.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  }
  expect(decisions.map((item) => item.action)).toEqual(["pass", "like"]);
  await card.tap({ position: { x: 60, y: 60 } });
  await expect(page).toHaveURL(new RegExp(`/profile/${auditIds.candidate}$`));
  await expect(
    page.getByRole("button", { name: "Go back", exact: true }),
  ).toBeVisible();
  expect(fixture.current.unexpected).toEqual([]);
});

test("a fully fitting card retains its upward Super Like gesture", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  const { fixture, decisions } = await setup(page);
  const scroll = page.getByTestId("discovery-scroll");
  await expect
    .poll(() =>
      scroll.evaluate((element) => element.scrollHeight - element.clientHeight),
    )
    .toBeLessThanOrEqual(1);
  const box = (await page.getByTestId("discovery-profile").boundingBox())!;
  await touchDrag(
    page,
    { x: box.x + box.width / 2, y: box.y + 260 },
    { x: box.x + box.width / 2, y: box.y + 60 },
  );
  await expect
    .poll(() => decisions.map((item) => item.action))
    .toEqual(["super"]);
  expect(decisions[0].target).toBe(auditIds.candidate);
  expect(fixture.current.unexpected).toEqual([]);
});
