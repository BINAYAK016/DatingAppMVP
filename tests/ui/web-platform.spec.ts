import { expect, test, type Page } from "@playwright/test";

async function enter(page: Page, name = "Aarav", group = "Men") {
  await page.goto("/demo");
  if (group !== "Men")
    await page.getByRole("button", { name: group, exact: true }).click();
  await page
    .getByRole("button", { name: "Enter as " + name, exact: true })
    .click();
  await expect(page.getByRole("tab", { name: /Discover/ })).toBeVisible();
}
test("web shell fits all requested widths, keeps four tabs and supports keyboard focus", async ({
  page,
}) => {
  await page.goto("/demo");
  const entry = page.getByRole("button", {
    name: "Enter as Aarav",
    exact: true,
  });
  await entry.focus();
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(
    () => getComputedStyle(document.activeElement!).outlineStyle,
  );
  expect(outline).toBe("solid");
  await entry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab")).toHaveCount(4);
  for (const width of [360, 390, 412, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    const frame = page.getByTestId("sangai-app-frame");
    await expect(frame).toBeVisible();
    expect((await frame.boundingBox())!.width).toBeLessThanOrEqual(
      Math.min(660, width),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.getByRole("tab", { name: /Chat/ }).click();
    await expect(
      page.getByRole("button", { name: "Chat with Anaya", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: /Profile/ }).click();
    await expect(
      page.getByRole("button", { name: "Profile settings", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: /Discover/ }).click();
  }
  await page.screenshot({ path: "artifacts/web-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/web-mobile.png", fullPage: true });
});
test("HttpOnly browser sign-in survives direct conversation refresh and logout removes it", async ({
  page,
  context,
  browserName,
}) => {
  const signedIn = page.waitForResponse(
    (response) =>
      response.url().endsWith("/v1/auth/demo") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await enter(page);
  const cookieAttributes = (
    (await (await signedIn).headerValue("set-cookie")) || ""
  )
    .split(";")
    .slice(1)
    .join(";");
  expect(cookieAttributes).toMatch(/SameSite=Lax/i);
  expect(cookieAttributes).toMatch(/HttpOnly/i);
  const cookie = (await context.cookies()).find((value) =>
    /sangai.*session/.test(value.name),
  );
  expect(cookie?.httpOnly).toBe(true);
  // Windows WebKit reports None via cookie inspection despite the explicit Lax
  // response attribute. This engine check is not Safari device evidence.
  if (browserName !== "webkit" || process.platform !== "win32")
    expect(cookie?.sameSite).toBe("Lax");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "sangai-local-session",
  );
  await page.getByRole("tab", { name: /Chat/ }).click();
  await page
    .getByRole("button", { name: "Chat with Anaya", exact: true })
    .click();
  const path = new URL(page.url()).pathname;
  await page.reload();
  await expect(
    page.getByPlaceholder("A thought, a question, a hello…"),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(path);
  expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain(
    "sangai-session",
  );
  await page.route("**/v1/state", (route) =>
    route.fulfill({ status: 503, json: { message: "Synthetic outage" } }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enter as Aarav", exact: true }),
  ).toBeVisible();
  expect(
    (await context.cookies()).some((value) =>
      /sangai.*session/.test(value.name),
    ),
  ).toBe(false);
});
test("unavailable session restore offers retry, preserving the cookie until recovery", async ({
  page,
}) => {
  await enter(page);
  await page.route("**/v1/auth/session", (route) => route.abort());
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry connection", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/v1/auth/session");
  await page
    .getByRole("button", { name: "Retry connection", exact: true })
    .click();
  await expect(
    page.getByText("DEMO MODE · Aarav", { exact: true }),
  ).toBeVisible();
});
test("changing account in another tab clears the old view before restoring the replacement", async ({
  page,
  context,
}) => {
  await enter(page);
  const other = await context.newPage();
  await enter(other, "Anaya", "Women");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("DEMO MODE · Anaya", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("DEMO MODE · Aarav", { exact: true }),
  ).toHaveCount(0);
  await other.close();
});
test("browser media cancellation releases the composer, and HEIC gives an actionable error", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("tab", { name: /Sangai/ }).click();
  await page
    .getByRole("button", { name: "Create Post", exact: true })
    .first()
    .click();
  const choose = page.getByRole("button", {
    name: "Choose photos",
    exact: true,
  });
  let picker = page.waitForEvent("filechooser");
  await choose.click();
  await (await picker).setFiles([]);
  await expect(choose).toBeEnabled();
  picker = page.waitForEvent("filechooser");
  await choose.click();
  await (
    await picker
  ).setFiles({
    name: "synthetic.heic",
    mimeType: "image/heic",
    buffer: Buffer.from("Synthetic unsupported image fixture"),
  });
  await expect(
    page.getByText(/This browser can’t preview HEIC photos/),
  ).toBeVisible();
  await expect(choose).toBeEnabled();
});
test("local export proxy preserves routes, blocks admin and returns API failures as JSON", async ({
  request,
}) => {
  expect((await request.get("/health")).ok()).toBe(true);
  expect(
    (await request.get("/chat/synthetic-route")).headers()["content-type"],
  ).toContain("text/html");
  expect((await request.get("/admin")).status()).toBe(404);
  expect((await request.get("/v1/ADMIN/metrics")).status()).toBe(404);
  expect((await request.get("/_expo/static/missing.js")).status()).toBe(404);
  const protectedRead = await request.get("/v1/state");
  expect(protectedRead.status()).toBe(401);
  expect(protectedRead.headers()["cache-control"]).toContain("no-store");
});
