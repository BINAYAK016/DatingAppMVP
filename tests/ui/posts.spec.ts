import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const actor = "10000000-0000-4000-8000-000000000001";
async function demo(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Try Aarav demo account", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Discover", exact: false }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Sangai", exact: false }).click();
  await page
    .getByRole("button", { name: "Create Post", exact: true })
    .first()
    .click();
}
test("photo selection, removal, crop, ordering and retry publish one private carousel", async ({
  page,
  request,
}) => {
  const login = await request.post("http://localhost:4100/v1/auth/demo", {
    data: { id: actor },
  });
  const token = (await login.json()).token;
  let postId: string | undefined;
  const uploadIds: string[] = [];
  page.on("response", async (response) => {
    if (
      response.url().endsWith("/v1/media") &&
      response.request().method() === "POST" &&
      response.ok()
    )
      uploadIds.push((await response.json()).id);
  });
  try {
    await demo(page);
    const colors = ["#CE697F", "#749D9A", "#C7B28A"];
    const files = await page.evaluate(
      (palette) =>
        palette.map((color, index) => {
          const canvas = document.createElement("canvas");
          canvas.width = 40;
          canvas.height = 60;
          const context = canvas.getContext("2d")!;
          context.fillStyle = color;
          context.fillRect(0, 0, 40, 60);
          return {
            name: `synthetic-${index + 1}.png`,
            data: canvas.toDataURL("image/png").split(",")[1],
          };
        }),
      colors,
    );
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Choose photos", exact: true })
      .click();
    await (
      await chooser
    ).setFiles(
      files.map((file) => ({
        name: file.name,
        mimeType: "image/png",
        buffer: Buffer.from(file.data, "base64"),
      })),
    );
    await expect(
      page.getByRole("button", { name: "Preview photo 3", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Preview photo 3", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove photo", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Preview photo 3", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Crop square", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Move photo later", exact: true })
      .click();
    const caption = `Synthetic carousel UX check ${Date.now()}`;
    await page
      .getByLabel("What’s on your mind?", { exact: true })
      .fill(caption);
    let attempts = 0;
    const payloads: any[] = [];
    await page.route("**/v1/posts", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      payloads.push(route.request().postDataJSON());
      attempts++;
      if (attempts === 1)
        return route.fulfill({
          status: 503,
          json: { message: "Synthetic temporary failure" },
        });
      return route.continue();
    });
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Post", exact: true }),
    ).toBeEnabled();
    expect(uploadIds).toHaveLength(2);
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/posts") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Post", exact: true }).click();
    postId = (await (await created).json()).id;
    await expect(page.getByText(caption, { exact: true })).toBeVisible();
    expect(uploadIds).toHaveLength(2);
    expect(payloads[1]).toEqual(payloads[0]);
    const detail = await request.get(
      `http://localhost:4100/v1/posts/${postId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect((await detail.json()).media.map((item: any) => item.id)).toEqual(
      uploadIds,
    );
    await page
      .getByRole("button", { name: "Next photo", exact: true })
      .first()
      .click();
    await expect(
      page.getByText("2 / 2", { exact: true }).first(),
    ).toBeVisible();
    await page.screenshot({ path: "artifacts/post-carousel-412.png" });
  } finally {
    if (postId)
      await request.delete(`http://localhost:4100/v1/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {},
      });
  }
});
test("small-phone composer protects a draft and keeps a plain-text post simple", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const login = await request.post("http://localhost:4100/v1/auth/demo", {
    data: { id: actor },
  });
  const token = (await login.json()).token;
  let postId: string | undefined;
  try {
    await demo(page);
    const caption = `Synthetic text UX check ${Date.now()}`;
    await page
      .getByLabel("What’s on your mind?", { exact: true })
      .fill(caption);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(
      page.getByText("Discard this draft?", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await expect(
      page.getByLabel("What’s on your mind?", { exact: true }),
    ).toHaveValue(caption);
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/posts") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Post", exact: true }).click();
    postId = (await (await created).json()).id;
    await expect(page.getByText(caption, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Read full moment", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ path: "artifacts/text-post-360.png" });
  } finally {
    if (postId)
      await request.delete(`http://localhost:4100/v1/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {},
      });
  }
});

test("likes respond before the network, roll back on failure, and comments stay reachable", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const login = await request.post("http://localhost:4100/v1/auth/demo", {
    data: { id: actor },
  });
  const token = (await login.json()).token;
  const state = await (
    await request.get("http://localhost:4100/v1/state", {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  const author = state.matches[0];
  const post = {
    id: randomUUID(),
    author,
    body: "Synthetic question: what makes a good first date?",
    created_at: new Date().toISOString(),
    liked: false,
    likes: 0,
    saved: false,
    comments: Array.from({ length: 40 }, (_, i) => ({
      id: randomUUID(),
      author,
      body: `Synthetic comment ${i + 1}`,
      created_at: new Date().toISOString(),
    })),
  };
  state.feed = [post];
  await page.route("**/v1/state", (route) => route.fulfill({ json: state }));
  let release: (() => void) | undefined;
  await page.route(`**/v1/posts/${post.id}/react`, async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({
      status: 503,
      json: { message: "We couldn’t save your like. Try again." },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Try Aarav demo account", exact: true })
    .click();
  await page.getByRole("tab", { name: "Sangai", exact: false }).click();
  const like = page.getByRole("button", { name: "Like post", exact: true });
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toBeDisabled();
  await expect.poll(() => !!release).toBeTruthy();
  release!();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(like).toBeEnabled();
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  await expect(
    page.getByLabel("A little thought…", { exact: true }),
  ).toBeVisible();
  await expect.poll(async () => {
    const box = await page.getByRole("button", { name: "Send reply", exact: true }).boundingBox();
    return box ? box.y + box.height : Infinity;
  }).toBeLessThanOrEqual(780);
  await page.screenshot({ path: "artifacts/post-comments-360.png" });
  await page.getByRole("button", { name: "Close sheet", exact: true }).click();
  await page.getByRole("button", { name: "Post options", exact: true }).click();
  await page
    .getByRole("button", { name: "Hide for this visit", exact: true })
    .click();
  await expect(
    page.getByText("Hidden for this visit.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo hide", exact: true }).click();
  await expect(page.getByText(post.body, { exact: true })).toBeVisible();
});
