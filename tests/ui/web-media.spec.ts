import { expect, test, type Page } from "@playwright/test";
import sharp from "../../apps/api/node_modules/sharp";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

const actor = "10000000-0000-4000-8000-000000000001";
const peer = "10000000-0000-4000-8000-000000000002";
const clip = resolve("apps/api/src/demo-assets/trail.mp4");
async function enter(page: Page, name = "Aarav") {
  await page.goto("/demo");
  if (name === "Anaya")
    await page.getByRole("button", { name: "Women", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter as " + name, exact: true })
    .click();
  await expect(page.getByRole("tab", { name: /Discover/ })).toBeVisible();
}
async function chooseVideo(page: Page) {
  const choosing = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose a short video", exact: true })
    .click();
  await (await choosing).setFiles(clip);
  const preview = page.getByRole("button", {
    name: "Remove video",
    exact: true,
  });
  const unsupported = page.getByText(/This browser can’t preview this video/);
  await expect(preview.or(unsupported)).toBeVisible();
  if (await unsupported.isVisible()) {
    await expect(
      page.getByRole("button", { name: "Choose a short video", exact: true }),
    ).toBeEnabled();
    return false;
  }
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((videos) =>
          videos.some((video) => (video as HTMLVideoElement).readyState >= 2),
        ),
    )
    .toBe(true);
  return true;
}
test("JPEG, PNG and WebP browser inputs compress and publish as three ordered private photos", async ({
  page,
  request,
}) => {
  const token = (
    await (
      await request.post("http://localhost:4100/v1/auth/demo", {
        data: { id: actor },
      })
    ).json()
  ).token;
  let postId: string | undefined;
  try {
    await enter(page);
    await page.getByRole("tab", { name: /Sangai/ }).click();
    await page
      .getByRole("button", { name: "Create Post", exact: true })
      .first()
      .click();
    const files = await Promise.all(
      ["jpeg", "png", "webp"].map(async (format) => ({
        name: "synthetic." + format,
        mimeType: "image/" + format,
        buffer: await sharp({
          create: {
            width: 96,
            height: 128,
            channels: 3,
            background: "#aa536b",
          },
        })
          .toFormat(format as "jpeg" | "png" | "webp")
          .toBuffer(),
      })),
    );
    const choosing = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Choose photos", exact: true })
      .click();
    await (await choosing).setFiles(files);
    await expect(
      page.getByRole("button", { name: /Preview photo \d/ }),
    ).toHaveCount(3);
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/posts") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Post", exact: true }).click();
    postId = (await (await saved).json()).id;
    const detail = await page.context().request.get("/v1/posts/" + postId);
    expect(detail.ok()).toBe(true);
    const attachments = (await detail.json()).media;
    expect(attachments).toHaveLength(3);
    expect(
      attachments.map((item: { position: number }) => item.position),
    ).toEqual([0, 1, 2]);
    for (const item of attachments) {
      const media = await page.context().request.get("/v1/media/" + item.id);
      expect(media.headers()["content-type"]).toContain("image/jpeg");
      expect(media.headers()["cache-control"]).toContain("no-store");
    }
  } finally {
    if (postId)
      await request.delete("http://localhost:4100/v1/posts/" + postId, {
        headers: { Authorization: "Bearer " + token },
        data: {},
      });
  }
});
test("MP4 stories and snaps play when decodable, with clear recovery for an unsupported decoder", async ({
  page,
  browser,
  request,
  browserName,
}) => {
  test.setTimeout(90000);
  const token = (
    await (
      await request.post("http://localhost:4100/v1/auth/demo", {
        data: { id: actor },
      })
    ).json()
  ).token;
  let storyId: string | undefined;
  const receiver = await browser.newContext({
    baseURL: process.env.SANGAI_WEB_TEST_URL || "http://localhost:8081",
    viewport: { width: 390, height: 844 },
  });
  try {
    await enter(page);
    await page.getByRole("tab", { name: /Chat/ }).click();
    await page.getByLabel("Add your story", { exact: true }).click();
    if (!(await chooseVideo(page))) {
      // The installed Windows WebKit engine rejects this verified H.264/yuv420p
      // fixture with MEDIA_ERR_SRC_NOT_SUPPORTED. Preserve visible error coverage
      // and record that its playback path requires macOS/Safari verification.
      expect(browserName).toBe("webkit");
      expect(process.platform).toBe("win32");
      test
        .info()
        .annotations.push({
          type: "limitation",
          description:
            "Windows WebKit cannot decode the H.264 fixture; unsupported picker recovery verified. Video playback requires macOS/Safari.",
        });
      return;
    }
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/stories") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await page
      .getByRole("button", { name: "Share story", exact: true })
      .click();
    storyId = (await (await saved).json()).id;
    await expect(page.getByRole("tab", { name: /Chat/ })).toBeVisible();
    await page.goto("/story/" + storyId);
    await page
      .getByRole("button", { name: "Pause story", exact: true })
      .click();
    await expect
      .poll(() =>
        page
          .locator("video")
          .evaluateAll((videos) =>
            videos.some((video) => (video as HTMLVideoElement).readyState >= 2),
          ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page
          .locator("video")
          .evaluateAll((videos) =>
            videos.every((video) => (video as HTMLVideoElement).paused),
          ),
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Resume story", exact: true })
      .click();
    await expect
      .poll(() =>
        page
          .locator("video")
          .evaluateAll((videos) =>
            videos.some((video) => (video as HTMLVideoElement).currentTime > 0),
          ),
      )
      .toBe(true);
    await page.goto("/chat/" + peer);
    await page
      .getByRole("button", { name: "Chat camera", exact: true })
      .click();
    await expect(
      page.getByText(
        "View once · unopened for 24 hours. Screenshots are possible.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(await chooseVideo(page)).toBe(true);
    const marker = "Synthetic video snap " + randomUUID();
    await page.getByLabel("A little caption", { exact: true }).fill(marker);
    const sent = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/snaps/" + peer) &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Send snap", exact: true }).click();
    const snapId = (await (await sent).json()).id;
    const other = await receiver.newPage();
    await enter(other, "Anaya");
    await other.getByRole("tab", { name: /Chat/ }).click();
    await other
      .getByRole("button", { name: "Chat with Aarav", exact: true })
      .click();
    const opened = other.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/snaps/" + snapId + "/open") &&
        response.ok(),
    );
    await other
      .getByRole("button", { name: "Open snap", exact: true })
      .last()
      .click();
    const mediaId = (await (await opened).json()).mediaId;
    await expect(
      other.getByRole("button", { name: "Close snap", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        other
          .locator("video")
          .evaluateAll((videos) =>
            videos.some((video) => (video as HTMLVideoElement).readyState >= 2),
          ),
      )
      .toBe(true);
    const closed = other.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/snaps/" + snapId + "/close") &&
        response.ok(),
    );
    await other.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await closed;
    await expect(
      other.getByRole("button", { name: "Close snap", exact: true }),
    ).toHaveCount(0);
    expect((await receiver.request.get("/v1/media/" + mediaId)).status()).toBe(
      404,
    );
  } finally {
    await receiver.close();
    if (storyId)
      await request.delete("http://localhost:4100/v1/stories/" + storyId, {
        headers: { Authorization: "Bearer " + token },
        data: {},
      });
  }
});
