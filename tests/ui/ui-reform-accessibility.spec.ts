import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { installAuditFixture } from "./reform-audit.fixture";

// Every API and external provider is intercepted by the strict synthetic fixture.
// These checks never sign in to a real account or send email/messages/media.
const widths = [360, 390, 768, 1024, 1440, 1920];
async function navigate(page: Page, name: string, width: number) {
  if (width >= 1024)
    await page
      .getByRole("link", { name: "Navigate to " + name, exact: true })
      .click();
  else await page.getByRole("tab", { name: new RegExp(name) }).click();
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}
async function target(locator: Locator, page: Page) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
}
async function tabLabelsAreNotClipped(page: Page) {
  const clipping = await page.getByRole("tab").evaluateAll((tabs) => {
    const failures: {
      label: string;
      topCut: number;
      bottomCut: number;
      leftCut: number;
      rightCut: number;
    }[] = [];
    for (const tab of tabs) {
      const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const label = node.textContent?.trim();
        if (
          !label ||
          !["Discover", "Chat", "Sangai", "Profile"].includes(label)
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        let top = 0,
          bottom = window.innerHeight,
          left = 0,
          right = window.innerWidth;
        let parent = node.parentElement;
        while (parent) {
          const style = getComputedStyle(parent),
            box = parent.getBoundingClientRect();
          if (["hidden", "clip", "auto", "scroll"].includes(style.overflowY)) {
            top = Math.max(top, box.top);
            bottom = Math.min(bottom, box.bottom);
          }
          if (["hidden", "clip", "auto", "scroll"].includes(style.overflowX)) {
            left = Math.max(left, box.left);
            right = Math.min(right, box.right);
          }
          parent = parent.parentElement;
        }
        if (
          text.top < top - 1 ||
          text.bottom > bottom + 1 ||
          text.left < left - 1 ||
          text.right > right + 1
        )
          failures.push({
            label,
            topCut: top - text.top,
            bottomCut: text.bottom - bottom,
            leftCut: left - text.left,
            rightCut: text.right - right,
          });
      }
    }
    return failures;
  });
  expect(
    clipping,
    "Every visible navigation label should fit inside its clipping ancestors",
  ).toEqual([]);
}
async function enlargeText(page: Page) {
  return page.evaluate(() => {
    // Snapshot all computed sizes before mutating any parent, so nested text
    // doubles once rather than inheriting an accidental 4x multiplier.
    const items = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter(
        (element) =>
          !element.closest('[aria-hidden="true"]') &&
          (element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            [...element.childNodes].some(
              (node) =>
                node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
            )),
      )
      .map((element) => {
        const computed = getComputedStyle(element);
        return {
          element,
          size: parseFloat(computed.fontSize),
          line: parseFloat(computed.lineHeight),
        };
      });
    items.forEach(({ element, size, line }) => {
      if (Number.isFinite(size))
        element.style.setProperty("font-size", `${size * 2}px`, "important");
      if (Number.isFinite(line))
        element.style.setProperty("line-height", `${line * 2}px`, "important");
    });
    return items.length;
  });
}
for (const width of widths) {
  test(`reform core navigation and controls fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const f = await installAuditFixture(page);
    f.reset();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await target(
      page.getByRole("button", { name: "Discovery preferences", exact: true }),
      page,
    );
    for (const name of ["Pass", "Like", "Super Like"])
      await target(page.getByRole("button", { name, exact: true }), page);
    await noHorizontalOverflow(page);
    await navigate(page, "Chat", width);
    await target(
      page.getByRole("button", { name: "Chat with Maya Audit", exact: true }),
      page,
    );
    await noHorizontalOverflow(page);
    await navigate(page, "Sangai", width);
    await target(
      page.getByRole("button", { name: "Create Post", exact: true }),
      page,
    );
    await noHorizontalOverflow(page);
    await navigate(page, "Profile", width);
    await target(
      page.getByRole("button", { name: "Edit profile", exact: true }),
      page,
    );
    await target(
      page.getByRole("button", { name: "Preview profile", exact: true }),
      page,
    );
    await expect(
      page.getByRole("heading", { name: "My profile", exact: true }),
    ).toBeVisible();
    await noHorizontalOverflow(page);
    if (width < 1024) await tabLabelsAreNotClipped(page);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.fonts.check('22px "sangai-ionicons"')),
    ).toBe(true);
    await mkdir("artifacts/ui-reform/accessibility", { recursive: true });
    await page.screenshot({
      path: `artifacts/ui-reform/accessibility/profile-${width}.png`,
    });
    expect(errors).toEqual([]);
    expect(f.current.unexpected).toEqual([]);
    expect(f.current.blockedExternal).toEqual([]);
  });
}
for (const width of [360, 1440]) {
  test(`reform named sheet traps keyboard focus and restores it at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const f = await installAuditFixture(page);
    f.reset();
    await page.goto("/");
    const trigger = page.getByRole("button", {
      name: "Discovery preferences",
      exact: true,
    });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "Your preferences",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Your preferences", exact: true }),
    ).toBeFocused();
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    const focus = page.locator(":focus");
    await expect(focus).toHaveCSS("outline-style", "solid");
    await expect(focus).toHaveCSS("outline-width", "3px");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(f.current.unexpected).toEqual([]);
    expect(f.current.writes).toEqual([]);
  });
}
for (const width of [390, 1440]) {
  test(`reform own profile survives long copy and actual 200 percent text at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const f = await installAuditFixture(page);
    f.reset();
    f.current.state.me.name = "Aarav Krishna Bhandari Subedi";
    f.current.state.me.bio =
      "I enjoy slow conversations, neighbourhood walks and learning about the little things that make people feel at home. ".repeat(
        4,
      );
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Discovery preferences", exact: true }),
    ).toBeVisible();
    await navigate(page, "Profile", width);
    const heading = page.getByRole("heading", {
      name: "My profile",
      exact: true,
    });
    const before = await heading.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    expect(await enlargeText(page)).toBeGreaterThan(10);
    await expect(heading).toHaveCSS("font-size", `${before * 2}px`);
    await target(
      page.getByRole("button", { name: "Edit profile", exact: true }),
      page,
    );
    await target(
      page.getByRole("button", { name: "Preview profile", exact: true }),
      page,
    );
    const privacy = page.getByRole("button", {
      name: "Open privacy settings",
      exact: true,
    });
    await privacy.scrollIntoViewIfNeeded();
    await target(privacy, page);
    if (width < 1024) await tabLabelsAreNotClipped(page);
    await noHorizontalOverflow(page);
    await mkdir("artifacts/ui-reform/accessibility", { recursive: true });
    await page.screenshot({
      path: `artifacts/ui-reform/accessibility/profile-200-text-${width}.png`,
    });
    expect(f.current.unexpected).toEqual([]);
    expect(f.current.writes).toEqual([]);
  });
}
test("reform form errors preserve entered values and fields stay usable at 200 percent text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  const f = await installAuditFixture(page);
  f.reset({ active: false });
  await page.goto("/welcome?account=1");
  await page
    .getByRole("button", { name: "Continue with email", exact: true })
    .click();
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  await email.fill("not-an-email");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Enter a valid email address." })
      .first(),
  ).toBeVisible();
  await expect(email).toHaveValue("not-an-email");
  const size = await email.evaluate((element) =>
    parseFloat(getComputedStyle(element).fontSize),
  );
  await enlargeText(page);
  await expect(email).toHaveCSS("font-size", `${size * 2}px`);
  await email.scrollIntoViewIfNeeded();
  await target(email, page);
  await target(
    page.getByRole("button", { name: "Create account", exact: true }),
    page,
  );
  await noHorizontalOverflow(page);
  expect(f.current.unexpected).toEqual([]);
  expect(f.current.writes).toEqual([]);
});
test("reform reduced-motion preference keeps loading static and browser controls still work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const f = await installAuditFixture(page);
  f.reset({ loading: "/state" });
  await page.goto("/");
  const skeleton = page.getByLabel("Loading", { exact: true }).first();
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toHaveCSS("opacity", "1");
  await page.waitForTimeout(250);
  await expect(skeleton).toHaveCSS("opacity", "1");
  await expect(
    page.getByRole("button", { name: "Discovery preferences", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Discovery preferences", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Your preferences", exact: true }),
  ).toBeVisible();
  const running = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === "running")
      .map((animation) => animation.effect?.getComputedTiming()),
  );
  // RNW can expose its reduced 0.01ms modal lifecycle animation before the
  // first paint. Reject real motion immediately, then allow that frame to finish.
  for (const timing of running) {
    expect(timing?.iterations).toBe(1);
    expect(Number(timing?.duration)).toBeLessThanOrEqual(0.01);
    expect(Number(timing?.endTime)).toBeLessThanOrEqual(0.01);
  }
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((animation) => animation.playState === "running").length,
        ),
      { timeout: 1000, intervals: [16, 32, 64] },
    )
    .toBe(0);
  expect(f.current.unexpected).toEqual([]);
});

test("reform landscape keeps navigation labels intact and primary actions reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const f = await installAuditFixture(page);
  f.reset();
  await page.goto("/");
  const like = page.getByRole("button", { name: "Like", exact: true });
  await like.scrollIntoViewIfNeeded();
  await target(like, page);
  await expect(like).toBeInViewport();
  await tabLabelsAreNotClipped(page);
  await navigate(page, "Profile", 844);
  await page
    .getByRole("button", { name: "Open privacy settings", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Privacy & safety",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", {
    name: "Close sheet",
    exact: true,
  });
  await expect(close).toBeInViewport();
  await noHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(f.current.unexpected).toEqual([]);
  expect(f.current.writes).toEqual([]);
});
test("reform profile fields have keyboard focus, helpful descriptions and recoverable drafts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const f = await installAuditFixture(page);
  f.reset();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Discovery preferences", exact: true }),
  ).toBeVisible();
  await navigate(page, "Profile", 390);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByRole("button", { name: "The basics", exact: true }).click();
  const name = page.getByRole("textbox", { name: "First name", exact: true });
  await expect(name).toHaveAccessibleDescription(
    "The name you want your matches to know.",
  );
  await expect(
    page.getByRole("button", { name: "Kathmandu", exact: true, pressed: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sydney", exact: true, pressed: false }),
  ).toBeVisible();
  await name.focus();
  await page.keyboard.type(" Updated");
  await expect(name).toHaveCSS("outline-width", "3px");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Kathmandu", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(name).toBeFocused();
  const draft = await name.inputValue();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Leave without saving?",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(name).toHaveValue(draft);
  expect(f.current.unexpected).toEqual([]);
  expect(f.current.writes).toEqual([]);
});
