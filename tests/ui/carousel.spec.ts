import { expect, test, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Person, Post, State } from "../../apps/mobile/src/lib/types";

const person: Person = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Synthetic Aarav",
  age: 25,
  city: "Kathmandu",
  bio: "Synthetic carousel test account",
  intent: "Relationship",
  interests: [],
  prompt: "Synthetic fixture",
  gender: "Man",
  color: "#F7E6E9",
  demo: true,
  languages: [],
  hobbies: [],
  profession: "",
  education: "",
  lifestyle: {},
};

async function expectAligned(photo: Locator) {
  await expect
    .poll(() =>
      photo.evaluate((element) => {
        let viewport = element.parentElement;
        while (viewport) {
          const overflow = getComputedStyle(viewport).overflowX;
          if (
            (overflow === "auto" || overflow === "scroll") &&
            viewport.scrollWidth > viewport.clientWidth
          ) {
            const frame = element.getBoundingClientRect();
            const bounds = viewport.getBoundingClientRect();
            return Math.max(
              Math.abs(frame.left - bounds.left),
              Math.abs(frame.width - viewport.clientWidth),
            );
          }
          viewport = viewport.parentElement;
        }
        return Infinity;
      }),
    )
    .toBeLessThanOrEqual(2);
  await expect(photo.getByLabel("Shared photo", { exact: true })).toBeVisible();
}

test("carousel keeps the fifth photo aligned through rotation and resets changed attachments", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const attachments = Array.from({ length: 6 }, (_, position) => ({
    id: randomUUID(),
    kind: "image",
    position,
  }));
  let post: Post = {
    id: randomUUID(),
    author: person,
    body: "Synthetic six-photo carousel",
    media_id: attachments[0].id,
    media: attachments,
    kind: "image",
    created_at: new Date().toISOString(),
    comments: [],
    liked: false,
    likes: 0,
    saved: false,
  };
  const state: State = {
    me: {
      ...person,
      email: "synthetic-carousel@example.test",
      email_verified_at: null,
      adult_declared_at: null,
      onboarded_at: null,
      onboarding_step: 0,
      birth_date: "2000-01-01",
      paused: false,
      notifications: false,
      posts_visible: true,
      stories_visible: true,
      messages_enabled: true,
      interactions_enabled: true,
      data_saver: false,
      preferences: {
        cities: [],
        genders: [],
        minAge: 18,
        maxAge: 70,
      },
    },
    matches: [],
    discover: [],
    undoId: null,
    feed: [post],
    stories: [],
    notifications: [],
    games: [],
  };
  const unexpected: string[] = [];
  await page.route("**/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === "/v1/auth/demo")
      return route.fulfill({
        json:
          method === "GET" ? [person] : { token: "synthetic-carousel-session" },
      });
    if (path === "/v1/auth/config")
      return route.fulfill({ json: { google: false } });
    if (path === "/v1/state") return route.fulfill({ json: state });
    if (path.startsWith("/v1/media/")) {
      const id = path.split("/").pop();
      const position = post.media?.findIndex((item) => item.id === id) ?? 0;
      return route.fulfill({
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100"><rect width="80" height="100" fill="hsl(${position * 55},55%,70%)"/><text x="20" y="50">${position + 1}</text></svg>`,
      });
    }
    if (path === `/v1/posts/${post.id}/react`)
      return route.fulfill({ json: { ok: true } });
    if (path === `/v1/posts/${post.id}`) return route.fulfill({ json: post });
    unexpected.push(`${method} ${path}`);
    return route.fulfill({
      status: 404,
      json: { message: "Synthetic fixture" },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Try Synthetic Aarav demo account",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Sangai", exact: false }).click();
  for (let number = 2; number <= 5; number++) {
    await page.getByRole("button", { name: "Next photo", exact: true }).click();
    await expect(
      page.getByText(`${number} / 6`, { exact: true }),
    ).toBeVisible();
    await expectAligned(
      page.getByRole("button", {
        name: `View full photo ${number}`,
        exact: true,
      }),
    );
  }
  const fifth = page.getByRole("button", {
    name: "View full photo 5",
    exact: true,
  });
  const portraitWidth = (await fifth.boundingBox())!.width;
  await page.screenshot({ path: testInfo.outputPath("fifth-portrait.png") });
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.getByText("5 / 6", { exact: true })).toBeVisible();
  await expectAligned(fifth);
  expect((await fifth.boundingBox())!.width).toBeGreaterThan(portraitWidth);
  await page.screenshot({ path: testInfo.outputPath("fifth-landscape.png") });

  // A rotation interrupting an animated Next must not accept old momentum.
  await page.getByRole("button", { name: "Next photo", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.getByText("6 / 6", { exact: true })).toBeVisible();
  await expectAligned(
    page.getByRole("button", { name: "View full photo 6", exact: true }),
  );
  await expect(
    page.getByRole("button", { name: "Next photo", exact: true }),
  ).toBeDisabled();

  const replacement = Array.from({ length: 2 }, (_, position) => ({
    id: randomUUID(),
    kind: "image",
    position,
  }));
  post = {
    ...post,
    liked: true,
    likes: 1,
    media_id: replacement[0].id,
    media: replacement,
  };
  state.feed = [post];
  // Refresh the same post in place so remounting the whole screen cannot mask it.
  await page.getByRole("button", { name: "Like post", exact: true }).click();
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  await expectAligned(
    page.getByRole("button", { name: "View full photo 1", exact: true }),
  );
  await expect(
    page.getByRole("button", { name: "Previous photo", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Next photo", exact: true }),
  ).toBeEnabled();
  expect(unexpected).toEqual([]);
});
