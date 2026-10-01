import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { gameDefinitionsV2 } from "../../apps/api/src/game-definitions";
import type { GameSessionV2 } from "../../apps/mobile/src/lib/gameV2";

const api = "http://localhost:4100/v1";
const aarav = "10000000-0000-4000-8000-000000000001";
const pema = "10000000-0000-4000-8000-000000000019";
const tavi = "10000000-0000-4000-8000-000000000027";

// The shared fictional world is explicitly restored around this journey.
// No application request is mocked, and no real account is touched.
async function restoreDemo(request: APIRequestContext) {
  const login = await request.post(`${api}/auth/demo`, {
    data: { id: aarav },
  });
  expect(login.ok(), "The known fictional reset actor must sign in").toBe(true);
  const { token } = await login.json();
  const reset = await request.post(`${api}/demo/reset`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { confirm: true },
    timeout: 120000,
  });
  expect(reset.ok(), "The confirmed shared demo reset must succeed").toBe(true);
}

async function enter(page: Page, name: string) {
  await page
    .getByRole("button", { name: `Enter as ${name}`, exact: true })
    .click();
  await expect(
    page
      .getByText(`DEMO MODE · ${name}`, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
}

async function swipe(page: Page, target: string, action: "pass" | "like") {
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/v1/discovery/${target}`) &&
      response.request().method() === "POST" &&
      response.request().postDataJSON()?.action === action,
  );
  await page
    .getByRole("button", {
      name: action === "pass" ? "Pass" : "Like",
      exact: true,
    })
    .click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  return response.json();
}

async function action(
  page: Page,
  id: string,
  name: string,
  expectedAction: string,
): Promise<GameSessionV2> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const control = page.getByRole("button", { name, exact: true });
    await expect(control).toBeVisible({ timeout: 12000 });
    await expect(control).toBeEnabled();
    const [response] = await Promise.all([
      page.waitForResponse(
        (next) =>
          next.url().endsWith(`/v1/game/${id}/action`) &&
          next.request().method() === "POST" &&
          next.request().postDataJSON()?.action === expectedAction,
        { timeout: 15000 },
      ),
      control.click(),
    ]);
    const outcome = await response.json();
    if (response.ok()) return outcome;
    // Another player's fast turn can invalidate the global revision while
    // this player's own question remains visible. Exercise the offered UI
    // recovery rather than bypassing revision checks or retrying HTTP directly.
    if (
      attempt === 0 &&
      response.status() === 409 &&
      outcome.message === "Your game changed. Refresh and try again."
    ) {
      await expect(
        page
          .getByText(outcome.message, { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      const refresh = page.getByRole("button", {
        name: "Refresh game",
        exact: true,
      });
      await expect(refresh).toBeEnabled();
      const [refreshed] = await Promise.all([
        page.waitForResponse(
          (next) =>
            next.url().endsWith(`/v1/game/${id}`) &&
            next.request().method() === "GET",
          { timeout: 15000 },
        ),
        refresh.click(),
      ]);
      expect(refreshed.ok()).toBe(true);
      continue;
    }
    throw new Error(
      `${expectedAction} failed with HTTP ${response.status()}: ${outcome.message}`,
    );
  }
  throw new Error(`${expectedAction} did not complete after explicit recovery`);
}

async function invite(host: Page, guest: Page, kind: string) {
  const definition = gameDefinitionsV2.find((game) => game.id === kind)!;
  await host
    .getByRole("button", { name: "Play together", exact: true })
    .click();
  await host
    .getByRole("button", { name: definition.category, exact: true })
    .click();
  await host
    .getByRole("button", { name: `Play ${definition.title}`, exact: true })
    .click();
  const sent = host.waitForResponse(
    (response) =>
      response.url().endsWith(`/v1/games/${tavi}/invite`) &&
      response.request().method() === "POST",
  );
  await host.getByRole("button", { name: "Send Invite", exact: true }).click();
  const response = await sent;
  expect(response.ok()).toBe(true);
  const session: GameSessionV2 = await response.json();
  expect(session.state).toBe("invited");
  expect(session.accepted_at).toBeNull();
  await expect(
    host
      .getByText("Your invitation is waiting", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  const invitation = guest.getByRole("button", {
    name: `${definition.title} · invited`,
    exact: true,
  });
  await expect(invitation).toBeVisible({ timeout: 12000 });
  // Tap the card title, avoiding its separate inline Accept & play button.
  await invitation.getByText(definition.title, { exact: true }).click();
  const accepted = await action(guest, session.id, "Let’s Play ❤️", "accept");
  expect(accepted.state).toBe("active");
  expect(accepted.accepted_at).not.toBeNull();
  return { id: session.id, definition };
}

async function choices(
  page: Page,
  id: string,
  kind: string,
): Promise<GameSessionV2> {
  const definition = gameDefinitionsV2.find((game) => game.id === kind)!;
  let saved!: GameSessionV2;
  if (kind === "rapid-fire")
    await action(page, id, "Start my 90 seconds", "start-timer");
  for (const question of definition.questions) {
    await expect(
      page.getByText(question.q, { exact: true }).filter({ visible: true }),
    ).toBeVisible({
      timeout: 12000,
    });
    await page
      .getByRole("button", { name: question.options[0].label, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Lock in my answer", exact: true }),
    ).toBeEnabled();
    saved = await action(page, id, "Lock in my answer", "choice");
  }
  return saved;
}

test.afterEach(async ({ request }) => {
  // A separate hook budget keeps cleanup available after a failed test timeout.
  test.setTimeout(120000);
  await restoreDemo(request);
});

test("real demo perspectives create a mutual match, chat and complete four explicitly accepted games", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(240000);
  const second = await browser.newContext({
    viewport: { width: 412, height: 915 },
  });
  const host = await second.newPage();
  page.setDefaultTimeout(15000);
  host.setDefaultTimeout(15000);
  try {
    await restoreDemo(request);
    await test.step("An unmatched Like stays private until the reciprocal swipe", async () => {
      await page.goto("/welcome");
      await enter(page, "Aarav");
      await expect(
        page.getByRole("button", { name: "View Pema's profile", exact: true }),
      ).toBeVisible();
      expect((await swipe(page, pema, "pass")).matched).toBe(false);
      await expect(
        page.getByRole("button", { name: "View Tavi's profile", exact: true }),
      ).toBeVisible();
      expect((await swipe(page, tavi, "like")).matched).toBe(false);
      await expect(
        page.getByText("Like sent.", { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByText("It’s a Match!", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Switch demo user", exact: true })
        .click();
      await page
        .getByRole("button", { name: "LGBTQ+ / Other", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Enter as Tavi", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Load more profiles", exact: true })
        .click();
      await enter(page, "Tavi");
      await expect(
        page.getByRole("button", { name: "View Aarav's profile", exact: true }),
      ).toBeVisible();
      expect((await swipe(page, aarav, "like")).matched).toBe(true);
      await expect(
        page.getByText("It’s a Match!", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Fictional demo connection", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("real-mutual-match.png"),
      });
      await page
        .getByRole("button", { name: "Start Chat", exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/chat/${aarav}$`));
      const hello = `A fictional hello from the real demo journey ${Date.now()}`;
      await page
        .getByPlaceholder("A thought, a question, a hello…")
        .fill(hello);
      const delivered = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/v1/chat/${aarav}`) &&
          response.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      expect((await delivered).ok()).toBe(true);
      await expect(page.getByText(hello, { exact: true })).toBeInViewport();
      await host.goto("http://localhost:8081/welcome");
      await enter(host, "Aarav");
      await host.getByRole("tab", { name: "Chat", exact: false }).click();
      await host
        .getByRole("button", { name: "Chat with Tavi", exact: true })
        .click();
      await expect(
        host.getByText(hello, { exact: true }).filter({ visible: true }),
      ).toBeVisible();
    });

    for (const kind of [
      "this-or-that",
      "would-you-rather",
      "two-truths",
      "rapid-fire",
    ]) {
      await test.step(`Invite, explicitly accept, play and reveal ${kind}`, async () => {
        const { id } = await invite(host, page, kind);
        let completed: GameSessionV2;
        if (kind === "two-truths") {
          for (const [author, guesser, name] of [
            [host, page, "Aarav"],
            [page, host, "Tavi"],
          ] as const) {
            const statements = [
              `${name} fictional first story`,
              `${name} fictional second story`,
              `${name} invented third story`,
            ];
            for (const [index, statement] of statements.entries())
              await author
                .getByRole("textbox", {
                  name: `Statement ${index + 1}`,
                  exact: true,
                })
                .fill(statement);
            await author
              .getByRole("button", {
                name: "Statement 3 is the lie",
                exact: true,
              })
              .click();
            const privateTurn = await action(
              author,
              id,
              "Lock in my statements",
              "submit-truths",
            );
            expect(privateTurn.results).toBeNull();
            await guesser
              .getByRole("button", { name: statements[2], exact: true })
              .click();
            completed = await action(guesser, id, "Lock in my guess", "guess");
          }
        } else {
          const privateAnswers = await choices(host, id, kind);
          expect(privateAnswers.complete).toBe(false);
          expect(privateAnswers.results).toBeNull();
          completed = await choices(page, id, kind);
        }
        expect(completed!.state).toBe("complete");
        expect(completed!.complete).toBe(true);
        const resultHeading = completed!.results!.heading;
        for (const client of [host, page]) {
          await expect(
            client
              .getByText(resultHeading, { exact: true })
              .filter({ visible: true }),
          ).toBeVisible({ timeout: 12000 });
          await expect(
            client
              .getByText(
                "A conversation starter. These choices don’t measure how compatible or safe someone is.",
                { exact: true },
              )
              .filter({ visible: true }),
          ).toBeVisible();
        }
        await host.screenshot({
          path: testInfo.outputPath(`${kind}-real-results.png`),
        });
        for (const [client, partner] of [
          [host, tavi],
          [page, aarav],
        ] as const) {
          await client
            .getByRole("button", { name: "Back to conversation", exact: true })
            .click();
          await expect(client).toHaveURL(new RegExp(`/chat/${partner}$`));
          await expect(
            client.getByPlaceholder("A thought, a question, a hello…"),
          ).toBeVisible();
        }
      });
    }
  } catch (error) {
    await Promise.allSettled([
      page.screenshot({
        path: testInfo.outputPath("guest-failure-before-cleanup.png"),
      }),
      host.screenshot({
        path: testInfo.outputPath("host-failure-before-cleanup.png"),
      }),
    ]);
    throw error;
  } finally {
    // Stop both contexts' polling before restoring the authorized demo baseline.
    await second.close().catch(() => {});
    if (!page.isClosed()) await page.goto("about:blank").catch(() => {});
  }
});
