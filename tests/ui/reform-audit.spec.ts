import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  auditGames,
  auditIds as ids,
  installAuditFixture,
  makeAuditGame,
  type AuditSetup,
} from "./reform-audit.fixture";

// Opt-in synthetic layout diagnostic: no real auth, OTP, provider or backend writes.
const enabled = process.env.SANGAI_UI_AUDIT === "1";
const phase = process.env.SANGAI_AUDIT_PHASE === "after" ? "after" : "before";
const only = process.env.SANGAI_AUDIT_FILTER;
type Row = {
  mode: string;
  route: string;
  viewport: { width: number; height: number };
  status: string;
  screenshot?: string;
  finalUrl?: string;
  detail?: string;
  horizontalOverflow?: number;
};
const click = async (p: Page, name: string) => {
  await p
    .getByRole("button", { name, exact: true })
    .filter({ visible: true })
    .first()
    .click({ timeout: 6000 });
};
const fill = async (p: Page, name: string | RegExp, value: string) => {
  await p
    .getByRole("textbox", { name, exact: typeof name === "string" })
    .fill(value, { timeout: 6000 });
};
for (const viewport of [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
]) {
  test(
    "ui-reform diagnostic route audit " + viewport.width,
    async ({ page }) => {
      test.skip(
        !enabled,
        "Set SANGAI_UI_AUDIT=1 for the opt-in screenshot audit.",
      );
      test.setTimeout(20 * 60 * 1000);
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const fixture = await installAuditFixture(page);
      const directory = join(
        "artifacts",
        "ui-reform",
        phase,
        String(viewport.width),
      );
      await mkdir(directory, { recursive: true });
      const rows: Row[] = [],
        runtimeErrors: string[] = [];
      if (only) {
        try {
          rows.push(
            ...JSON.parse(
              await readFile(join(directory, "coverage.json"), "utf8"),
            ).rows,
          );
        } catch {}
      }
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      const transport: unknown[] = [];
      page.on("response", async (response) => {
        if (/\/v1\/(profiles|notifications)/.test(response.url())) {
          transport.push({
            path: new URL(response.url()).pathname,
            status: response.status(),
            body: (await response.text().catch(() => "")).slice(0, 800),
          });
        }
      });
      const capture = async (
        mode: string,
        route: string,
        marker: string,
        setup: AuditSetup = {},
        action?: () => Promise<void>,
      ) => {
        if (only && !new RegExp(only).test(mode)) return;
        fixture.reset(setup);
        const row: Row = { mode, route, viewport, status: "pending" };
        const previous = rows.findIndex((item) => item.mode === mode);
        if (previous >= 0) rows.splice(previous, 1);
        rows.push(row);
        try {
          if (
            setup.active !== false &&
            setup.onboarding === undefined &&
            route !== "/"
          ) {
            // Normal authenticated route screenshots start after the existing
            // bootstrap. Separate cold-load failure PNGs are retained from the
            // initial audit; this harness does not change auth behavior.
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await expect(
              page.getByRole("button", {
                name: "Discovery preferences",
                exact: true,
              }),
            ).toBeVisible({ timeout: 10000 });
            const navigateTab = async (name: string) => {
              if (viewport.width >= 1024)
                await page
                  .getByRole("link", {
                    name: "Navigate to " + name,
                    exact: true,
                  })
                  .click();
              else
                await page.getByRole("tab", { name: new RegExp(name) }).click();
            };
            if (route.startsWith("/profile/")) {
              if (route.endsWith(ids.candidate))
                await (
                  phase === "after"
                    ? page.getByTestId("discovery-profile")
                    : page.getByRole("button", {
                        name: "View Nisha Audit's profile",
                        exact: true,
                      })
                ).click();
              else if (route.endsWith(ids.me)) {
                await navigateTab("Profile");
                await click(page, "Preview profile");
              } else {
                await navigateTab("Chat");
                await click(page, "Chat with Maya Audit");
                await click(page, "View profile");
              }
            } else if (route === "/activity") {
              await navigateTab("Chat");
              await click(page, "Open activity");
            } else {
              await page.evaluate((destination) => {
                window.history.pushState({}, "", destination);
                window.dispatchEvent(
                  new PopStateEvent("popstate", { state: {} }),
                );
              }, route);
            }
            row.detail =
              "Authenticated route rendered after existing app bootstrap via browser route navigation; no auth implementation bypass.";
          } else {
            await page.goto(route, { waitUntil: "domcontentloaded" });
          }
          if (marker)
            await expect(
              page
                .getByText(marker, { exact: true })
                .filter({ visible: true })
                .first(),
            ).toBeVisible({ timeout: 10000 });
          // Tab labels exist before lazily loaded route content is ready.
          if (mode === "discover") {
            const card =
              phase === "after"
                ? page.getByTestId("discovery-profile")
                : page.getByRole("button", {
                    name: "View Nisha Audit's profile",
                    exact: true,
                  });
            await expect(card).toBeVisible();
          }
          if (mode === "feed")
            await expect(
              page
                .getByText(
                  "What is your perfect slow Sunday? This is a synthetic audit moment.",
                  { exact: true },
                )
                .filter({ visible: true })
                .first(),
            ).toBeVisible();
          // A desktop rail can repeat a name before the detail request renders.
          // Assert content, not only the persistent chrome, for normal detail states.
          if (/^profile-preview-|^profile-options$/.test(mode))
            await expect(
              page
                .getByText(marker + ", 28", { exact: true })
                .filter({ visible: true })
                .first(),
            ).toBeVisible();
          if (mode === "activity")
            await expect(
              page
                .getByText("Maya Audit invited you to play This or That.", {
                  exact: true,
                })
                .filter({ visible: true })
                .first(),
            ).toBeVisible();
          if (["my-posts", "saved-posts"].includes(mode))
            await expect(
              page
                .getByText(
                  "A little everyday moment. Synthetic audit content.",
                  { exact: true },
                )
                .filter({ visible: true })
                .first(),
            ).toBeVisible();
          if (action) await action();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(setup.loading ? 150 : 250);
          const screenshot = join(directory, mode + ".png");
          await page.screenshot({
            path: screenshot,
            fullPage: false,
            animations: "disabled",
          });
          Object.assign(row, {
            status: "captured",
            screenshot,
            finalUrl: page.url(),
            horizontalOverflow: await page.evaluate(() =>
              Math.max(
                0,
                document.documentElement.scrollWidth - window.innerWidth,
              ),
            ),
          });
        } catch (error) {
          row.status = "not-reproduced";
          row.detail =
            String(error).slice(0, 1500) +
            "\nTransport: " +
            JSON.stringify(transport.slice(-6));
          row.finalUrl = page.url();
          await page
            .screenshot({
              path: join(directory, mode + ".failure.png"),
              animations: "disabled",
            })
            .catch(() => {});
        }
        await writeFile(
          join(directory, "coverage.json"),
          JSON.stringify(
            {
              phase,
              viewport,
              screenshots:
                "First viewport of each route/mode. Lower content is captured where a scenario scrolls to its action.",
              data: "Entirely synthetic browser fixtures; all /v1 requests intercepted and external providers blocked.",
              rows,
              runtimeErrors,
              unexpectedApi: fixture.current.unexpected,
              blockedExternal: fixture.current.blockedExternal,
              mockedWrites: fixture.current.writes,
              notExercised: [
                "Real email or Google auth",
                "Native permission sheets, actual camera/recording, video codecs",
                "Native push registration",
                "Physical iOS/Android runtime and screen readers",
                "Real backend authorization or persistence",
                "Operator moderation frontend and server policy HTML; backend files excluded",
              ],
            },
            null,
            2,
          ),
        );
      };
      const out = { active: false };
      const welcome = "Meet people.\nFind your together.";
      await capture("welcome", "/welcome?account=1", welcome, out);
      await capture("welcome-alias-root", "/?account=1", welcome, out);
      await capture("register", "/welcome?account=1", welcome, out, async () =>
        click(page, "Continue with email"),
      );
      await capture("login", "/welcome?account=1", welcome, out, async () =>
        click(page, "I already have an account"),
      );
      await capture(
        "register-validation",
        "/welcome?account=1",
        welcome,
        out,
        async () => {
          await click(page, "Continue with email");
          await click(page, "Create account");
        },
      );
      await capture(
        "reset-email",
        "/reset-password",
        "Find your way back",
        out,
      );
      await capture(
        "reset-code",
        "/reset-password",
        "Find your way back",
        out,
        async () => {
          await fill(page, "Email", "synthetic-audit@example.test");
          await click(page, "Send reset code");
          await expect(
            page.getByText("A fresh start", { exact: true }),
          ).toBeVisible();
        },
      );
      await capture("demo-signed-out", "/demo", "Choose a profile", out);
      await capture("demo-current-session", "/demo", "Choose a profile");
      for (const group of ["Women", "LGBTQ+ / Other"])
        await capture(
          "demo-" + (group === "Women" ? "women" : "lgbtq"),
          "/demo",
          "Choose a profile",
          out,
          async () => click(page, group),
        );
      await capture("demo-list-error", "/demo", "Choose a profile", {
        ...out,
        failed: "/demo/users",
      });
      await capture("onboarding-verify", "/onboarding", "Verify your email", {
        onboarding: "verify",
        demoMode: false,
      });
      const sectionTitles = [
        "The basics",
        "Your first impression",
        "What matters to you",
        "Your preferences",
        "Your conversation starter",
      ];
      for (let step = 0; step < 5; step++)
        await capture(
          "onboarding-step-" + (step + 1),
          "/onboarding",
          sectionTitles[step],
          { onboarding: step, demoMode: false },
        );
      await capture(
        "bootstrap-loading",
        "/",
        "",
        { loading: "/auth/session" },
        async () => {
          await expect(
            page.getByLabel("Loading", { exact: true }).first(),
          ).toBeVisible({ timeout: 2000 });
        },
      );
      await capture("discover", "/", "Discover");
      await capture("discover-preferences", "/", "Discover", {}, async () =>
        click(page, "Discovery preferences"),
      );
      await capture("discover-empty", "/", "You’re all caught up", {
        empty: true,
      });
      await capture("discover-paused", "/", "You’re taking a pause", {
        paused: true,
      });
      await capture("discover-match", "/", "Discover", {}, async () => {
        await click(page, "Like");
        await expect(
          page.getByText("It’s a Match!", { exact: true }),
        ).toBeVisible();
      });
      await capture(
        "discover-failure",
        "/",
        "Discover",
        { failed: "/discovery/" + ids.candidate },
        async () => {
          await click(page, "Like");
          await expect(
            page.getByText("Let’s try again", { exact: true }),
          ).toBeVisible();
        },
      );
      await capture("chat-list", "/chat", "Conversations");
      await capture("chat-empty", "/chat", "Chat", { empty: true });
      const chat = "/chat/" + ids.match;
      await capture("conversation", chat, "Coffee and a walk sounds lovely.");
      await capture(
        "conversation-actions",
        chat,
        "Coffee and a walk sounds lovely.",
        {},
        async () => click(page, "Conversation actions"),
      );
      await capture(
        "conversation-options",
        chat,
        "Coffee and a walk sounds lovely.",
        {},
        async () => click(page, "Chat options"),
      );
      await capture(
        "conversation-snap-viewer",
        chat,
        "Coffee and a walk sounds lovely.",
        {},
        async () => {
          await click(page, "Open snap");
          await expect(
            page.getByText("View once · up to 30 seconds", { exact: true }),
          ).toBeVisible();
        },
      );
      await capture(
        "conversation-empty",
        chat,
        "A little hello goes a long way",
        { empty: true },
      );
      await capture(
        "conversation-error",
        chat,
        "Your conversation couldn’t load. Check your connection and try again.",
        { failed: "/chat/" + ids.match },
      );
      await capture("feed", "/sangai", "Sangai");
      await capture("feed-empty", "/sangai", "Sangai", { empty: true });
      const post = "/post/" + ids.post,
        postText =
          "What is your perfect slow Sunday? This is a synthetic audit moment.";
      await capture("post-detail", post, postText);
      await capture("post-comments", post, postText, {}, async () =>
        click(page, "Comments"),
      );
      await capture("post-reply", post, postText, {}, async () => {
        await click(page, "Comments");
        await click(page, "Reply to Aarav Audit");
      });
      await capture("post-share", post, postText, {}, async () =>
        click(page, "Share privately"),
      );
      await capture("post-options", post, postText, {}, async () =>
        click(page, "Post options"),
      );
      await capture("post-photo", post, postText, {}, async () =>
        click(page, "View full photo 1"),
      );
      await capture(
        "post-delete-confirm",
        "/post/" + ids.ownPost,
        "A little everyday moment. Synthetic audit content.",
        {},
        async () => {
          await click(page, "Post options");
          await click(page, "Delete my post");
        },
      );
      await capture(
        "post-unavailable",
        post,
        "This moment couldn’t load. Try again, or check back later.",
        {
          unavailable: "/posts/" + ids.post,
        },
      );
      for (const kind of [
        "post",
        "story",
        "snap",
        "message",
        "avatar",
        "gallery",
      ])
        await capture(
          "compose-" + kind,
          "/compose?kind=" + kind + "&target=" + ids.match,
          kind === "post"
            ? "Create Post"
            : kind === "story"
              ? "Your story"
              : kind === "snap"
                ? "Send a snap"
                : kind === "message"
                  ? "Photo or video"
                  : "Your profile photo",
        );
      await capture(
        "compose-discard",
        "/compose?kind=post",
        "Create Post",
        {},
        async () => {
          await fill(page, "What’s on your mind?", "Synthetic unsaved caption");
          await click(page, "Go back");
        },
      );
      await capture("profile-own", "/profile", "YOUR PROFILE AT A GLANCE");
      for (const section of [
        "privacy",
        "discovery",
        "notifications",
        "account",
      ])
        await capture(
          "profile-settings-" + section,
          "/profile",
          "YOUR PROFILE AT A GLANCE",
          {},
          async () => click(page, "Open " + section + " settings"),
        );
      await capture(
        "profile-delete-confirm",
        "/profile",
        "YOUR PROFILE AT A GLANCE",
        {},
        async () => {
          await click(page, "Open account settings");
          await click(page, "Delete my account");
        },
      );
      await capture(
        "profile-demo-reset",
        "/profile",
        "YOUR PROFILE AT A GLANCE",
        {},
        async () => click(page, "Reset Demo"),
      );
      await capture("edit-profile-sections", "/edit-profile", "Edit profile");
      for (let section = 0; section < 5; section++)
        await capture(
          "edit-profile-section-" + (section + 1),
          "/edit-profile?section=" + section,
          "Edit profile",
        );
      await capture(
        "edit-profile-lifestyle",
        "/edit-profile?section=3",
        "Edit profile",
        {},
        async () => click(page, "Lifestyle"),
      );
      await capture(
        "edit-profile-media-remove",
        "/edit-profile?section=1",
        "Edit profile",
        {},
        async () => click(page, "Remove from profile"),
      );
      await capture(
        "edit-profile-discard",
        "/edit-profile?section=0",
        "Edit profile",
        {},
        async () => {
          await fill(page, "First name", "Unsaved audit name");
          await click(page, "Go back");
        },
      );
      await capture(
        "profile-preview-self",
        "/profile/" + ids.me,
        "Aarav Audit",
      );
      await capture(
        "profile-preview-match",
        "/profile/" + ids.match,
        "Maya Audit",
      );
      await capture(
        "profile-preview-candidate",
        "/profile/" + ids.candidate,
        "Nisha Audit",
      );
      await capture(
        "profile-options",
        "/profile/" + ids.match,
        "Maya Audit",
        {},
        async () => click(page, "Profile options"),
      );
      await capture(
        "profile-unavailable",
        "/profile/" + ids.match,
        "Profile unavailable",
        { unavailable: "/profiles/" + ids.match },
      );
      await capture(
        "profile-network-error",
        "/profile/" + ids.match,
        "We couldn’t open this profile. Check your connection and try again.",
        { failed: "/profiles/" + ids.match },
      );
      await capture(
        "story-text",
        "/story/" + ids.story,
        "Just your matches",
        {},
        async () => click(page, "Pause story"),
      );
      await capture(
        "story-own-options",
        "/story/" + ids.ownStory,
        "Just your matches",
        {},
        async () => {
          await click(page, "Pause story");
          await click(page, "Story options");
        },
      );
      await capture(
        "story-unavailable",
        "/story/audit-missing",
        "This story is unavailable",
      );
      await capture("activity", "/activity", "Activity");
      await capture("activity-empty", "/activity", "All caught up", {
        empty: true,
      });
      await capture("activity-error", "/activity", "Activity", {
        failed: "/notifications",
      });
      for (const scope of ["my-posts", "saved-posts"]) {
        const title = scope === "my-posts" ? "My moments" : "Saved moments";
        await capture(scope, "/" + scope, title);
        await capture(scope + "-empty", "/" + scope, title, { empty: true });
        await capture(scope + "-error", "/" + scope, title, {
          failed: scope === "my-posts" ? "/feed" : "/saved-posts",
        });
      }
      await capture("safety-overview", "/safety", "Your comfort matters.");
      await capture("safety-empty", "/safety", "Your comfort matters.", {
        empty: true,
      });
      await capture("safety-error", "/safety", "Your comfort matters.", {
        failed: "/blocks",
      });
      const safety = "/safety?target=" + ids.match + "&context=chat";
      await capture("safety-target", safety, "Your comfort matters.");
      for (const [name, label] of [
        ["report", "Submit a private report"],
        ["block", "Block this person"],
        ["unmatch", "End this match"],
      ])
        await capture(
          "safety-" + name,
          safety,
          "Your comfort matters.",
          {},
          async () => click(page, label),
        );
      const plan = "/plan?target=" + ids.match;
      await capture("plan-activity", plan, "What sounds good?");
      await capture("plan-details", plan, "What sounds good?", {}, async () => {
        await click(page, "Coffee");
        await click(page, "Continue");
      });
      await capture(
        "plan-validation",
        plan,
        "What sounds good?",
        {},
        async () => {
          await click(page, "Coffee");
          await click(page, "Continue");
          await fill(page, "Date · YYYY-MM-DD", "2027-02-30");
          await click(page, "Continue");
        },
      );
      await capture("plan-review", plan, "What sounds good?", {}, async () => {
        await click(page, "Coffee");
        await click(page, "Continue");
        await fill(page, "Date · YYYY-MM-DD", "2099-01-02");
        await click(page, "Continue");
      });
      await capture("subscriptions-monthly", "/subscriptions", "Sangai Plus");
      await capture(
        "subscriptions-annual-au",
        "/subscriptions",
        "Sangai Plus",
        {},
        async () => {
          await click(page, "Australia");
          await click(page, "Annual · save 20%");
        },
      );
      await capture(
        "subscription-preview-monthly",
        "/subscription-preview?region=NP&period=monthly",
        "Your Plus preview",
      );
      await capture(
        "subscription-preview-annual",
        "/subscription-preview?region=AU&period=annual",
        "Your Plus preview",
      );
      const games = "/games?target=" + ids.match;
      await capture("games-catalog", games, "Quick Play");
      for (const category of [
        "Get to know you",
        "Make them laugh",
        "See if you click",
      ])
        await capture(
          "games-category-" + category.toLowerCase().replaceAll(" ", "-"),
          games,
          "Quick Play",
          {},
          async () => click(page, category),
        );
      await capture(
        "games-invite-confirm",
        games + "&kind=" + auditGames[0].id,
        "Send Invite",
      );
      await capture("games-current", games, "Your game is in progress", {
        game: makeAuditGame(),
      });
      await capture("games-no-match", "/games", "It takes two");
      await capture("games-legacy-picker", games, "Dating games", {
        legacy: true,
      });
      const gamePath =
        "/game/" + ids.game + "?target=" + ids.match + "&version=2";
      for (let i = 0; i < auditGames.length; i++) {
        const g = makeAuditGame(i);
        await capture(
          "game-" + g.kind + "-active",
          gamePath,
          g.definition.title,
          { game: g },
        );
        const result = {
          ...g,
          state: "complete",
          complete: true,
          bothAnswered: true,
          results: {
            heading: "A little more to talk about",
            conversationPrompt: "What surprised you most?",
            agree: [{ question: "Beach or mountains?", choice: "Mountains" }],
            different: [
              {
                question: "A perfect morning?",
                you: "Coffee",
                partner: "A walk",
              },
            ],
            reveals: [
              {
                title: "A shared moment",
                body: "Synthetic answer revealed after both players completed the game.",
              },
            ],
          },
        };
        await capture(
          "game-" + g.kind + "-results",
          gamePath,
          "A little more to talk about",
          { game: result },
        );
      }
      const invited = makeAuditGame();
      invited.state = "invited";
      invited.host = ids.match;
      invited.guest = ids.me;
      invited.accepted_at = null;
      invited.view.phase = "closed";
      invited.view.canAct = false;
      await capture(
        "game-invitation-received",
        gamePath,
        "Maya Audit wants to play",
        { game: invited },
      );
      await capture("game-waiting", gamePath, auditGames[0].title, {
        game: makeAuditGame(0, "waiting"),
      });
      const closed = makeAuditGame();
      closed.state = "cancelled";
      closed.view.canAct = false;
      closed.view.phase = "closed";
      await capture("game-closed", gamePath, "Game cancelled", {
        game: closed,
      });
      await capture("game-unavailable", gamePath, "Game unavailable", {
        game: null,
      });
      await capture("game-error", gamePath, "Play together", {
        failed: "/game/" + ids.game,
      });
      for (const [mechanic, nextPhase] of [
        ["truths", "guess-truths"],
        ["guess", "guess-answer"],
        ["questions", "respond"],
      ] as const) {
        const i = auditGames.findIndex((g) => g.mechanic === mechanic);
        await capture(
          "game-phase-" + nextPhase,
          gamePath,
          auditGames[i].title,
          { game: makeAuditGame(i, nextPhase) },
        );
      }
      await capture("bootstrap-error", "/", "Let’s reconnect", {
        failed: "/auth/session",
      });
      await capture("session-recovery", "/", "Let’s reconnect", {
        failed: "/state",
      });
      const failures = rows.filter((r) => r.status !== "captured");
      console.log(
        JSON.stringify({
          viewport,
          captures: rows.length - failures.length,
          notReproduced: failures.map((r) => r.mode),
          manifest: join(directory, "coverage.json"),
        }),
      );
      expect(
        failures.map((row) => row.mode),
        "Every selected route/mode must have a rendered screenshot; inspect coverage.json for diagnostics.",
      ).toEqual([]);
      expect(
        fixture.current.unexpected,
        "Audit fixtures must intercept every API contract used by these screens.",
      ).toEqual([]);
      expect(
        runtimeErrors,
        "Rendered audit routes must not throw browser runtime errors.",
      ).toEqual([]);
    },
  );
}
