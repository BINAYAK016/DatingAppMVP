import type { Page, Route } from "@playwright/test";
import { gameDefinitionsV2 } from "../../apps/api/src/game-definitions";
import type { Person, State } from "../../apps/mobile/src/lib/types";
import type { GameSessionV2 } from "../../apps/mobile/src/lib/gameV2";

export const auditIds = {
  me: "91000000-0000-4000-8000-000000000001",
  match: "91000000-0000-4000-8000-000000000002",
  candidate: "91000000-0000-4000-8000-000000000003",
  post: "92000000-0000-4000-8000-000000000001",
  ownPost: "92000000-0000-4000-8000-000000000002",
  story: "93000000-0000-4000-8000-000000000001",
  ownStory: "93000000-0000-4000-8000-000000000002",
  game: "94000000-0000-4000-8000-000000000001",
  snap: "95000000-0000-4000-8000-000000000001",
};
export const auditGames = gameDefinitionsV2;
const stamp = "2026-10-08T04:00:00.000Z";
function person(id: string, name: string, gender = "Woman"): Person {
  return {
    id,
    name,
    age: 28,
    city: "Kathmandu",
    demo: true,
    gender,
    bio: "Synthetic audit profile. A little coffee, a long walk and a good conversation.",
    intent: "Serious relationship",
    interests: ["Coffee", "Hiking", "Music"],
    prompt: "My ideal weekend starts with a new trail and ends with momos.",
    languages: ["Nepali", "English"],
    hobbies: ["Walking"],
    profession: "Designer",
    education: "University graduate",
    lifestyle: { pets: "Dog person" },
    color: "#F7E6E9",
    media: [{ id: "audit-photo", kind: "image", position: 0 }],
  };
}
export const auditMe = person(auditIds.me, "Aarav Audit", "Man");
export const auditMatch = {
  ...person(auditIds.match, "Maya Audit"),
  preview: "Coffee and a walk sounds lovely.",
  unread: 2,
};
export const auditCandidate = person(auditIds.candidate, "Nisha Audit");
export function makeAuditState(): State {
  return {
    me: {
      ...structuredClone(auditMe),
      email: "synthetic-audit@example.test",
      email_verified_at: stamp,
      adult_declared_at: stamp,
      onboarded_at: stamp,
      onboarding_step: 5,
      birth_date: "1998-01-01",
      paused: false,
      notifications: false,
      posts_visible: true,
      stories_visible: true,
      messages_enabled: true,
      interactions_enabled: true,
      data_saver: true,
      preferences: {
        cities: ["Kathmandu", "Sydney"],
        genders: ["Woman"],
        minAge: 21,
        maxAge: 35,
        intents: ["Serious relationship", "Marriage", "Casual dating"],
      },
    },
    features: { gamesV2: true },
    discover: [structuredClone(auditCandidate)],
    matches: [structuredClone(auditMatch)],
    undoId: null,
    feed: [
      {
        id: auditIds.post,
        author: auditMatch,
        body: "What is your perfect slow Sunday? This is a synthetic audit moment.",
        created_at: stamp,
        likes: 3,
        liked: false,
        saved: false,
        media_id: "audit-photo",
        kind: "image",
        media: [
          { id: "audit-photo", kind: "image", position: 0 },
          { id: "audit-photo-two", kind: "image", position: 1 },
        ],
        comments: [
          {
            id: "audit-comment",
            author: auditMe,
            body: "A walk and a warm cup of coffee.",
            created_at: stamp,
          },
        ],
      },
      {
        id: auditIds.ownPost,
        author: auditMe,
        body: "A little everyday moment. Synthetic audit content.",
        created_at: stamp,
        likes: 0,
        liked: false,
        saved: true,
        comments: [],
      },
    ],
    stories: [
      {
        id: auditIds.story,
        author: auditMatch,
        body: "A quiet morning, a little sunshine. Synthetic audit story.",
        expires_at: "2099-01-01T00:00:00Z",
      },
      {
        id: auditIds.ownStory,
        author: auditMe,
        body: "My synthetic audit story.",
        expires_at: "2099-01-01T00:00:00Z",
      },
    ],
    notifications: [
      {
        id: "audit-notification",
        body: "Maya Audit invited you to play This or That.",
        kind: "game",
        read: false,
        created_at: stamp,
        resource_type: "game",
        resource_id: auditIds.game,
      },
    ],
    games: gameDefinitionsV2.map((d) => ({
      ...d,
      questions: d.questions.map((q) => ({
        q: q.q,
        options: q.options.map((o) => o.label),
      })),
    })),
  };
}
export function makeAuditGame(
  index = 0,
  phase?: GameSessionV2["view"]["phase"],
): GameSessionV2 {
  const definition = gameDefinitionsV2[index];
  const initial =
    phase ||
    (
      {
        choices: "choices",
        truths: "write-truths",
        guess: "set-answer",
        rapid: "start-timer",
        questions: "ask",
      } as const
    )[definition.mechanic];
  return {
    id: auditIds.game,
    host: auditIds.me,
    guest: auditIds.match,
    kind: definition.id,
    version: 2,
    state: "active",
    revision: 1,
    definition_version: definition.definitionVersion,
    created_at: stamp,
    updated_at: stamp,
    expires_at: "2099-01-01T00:00:00Z",
    accepted_at: stamp,
    definition,
    view: {
      phase: initial,
      canAct: true,
      round: 0,
      total: definition.questions.length || 2,
      question: definition.questions[0],
      revealed: [],
      statements: [
        "I have hiked at sunrise.",
        "I make excellent momos.",
        "I have met a penguin.",
      ],
      prompt: "What is a small thing that makes your day?",
    },
    results: null,
    complete: false,
    answered: false,
    bothAnswered: false,
  };
}
export type AuditSetup = {
  active?: boolean;
  demoMode?: boolean;
  empty?: boolean;
  ownPost?: boolean;
  onboarding?: number | "verify";
  unavailable?: string;
  failed?: string;
  game?: GameSessionV2 | null;
  paused?: boolean;
  legacy?: boolean;
  loading?: string;
};
export async function installAuditFixture(page: Page) {
  const control = {
    state: makeAuditState(),
    setup: {} as AuditSetup,
    unexpected: [] as string[],
    blockedExternal: [] as string[],
    writes: [] as string[],
  };
  function reset(setup: AuditSetup = {}) {
    control.setup = setup;
    control.state = makeAuditState();
    if (setup.empty)
      Object.assign(control.state, {
        discover: [],
        matches: [],
        feed: [],
        stories: [],
        notifications: [],
      });
    if (setup.paused) {
      control.state.me.paused = true;
      control.state.discover = [];
    }
    if (setup.legacy) control.state.features = { gamesV2: false };
    if (setup.onboarding !== undefined) {
      control.state.me.demo = false;
      control.state.me.onboarded_at = null;
      control.state.me.onboarding_step =
        setup.onboarding === "verify" ? 0 : setup.onboarding;
      if (setup.onboarding === "verify")
        control.state.me.email_verified_at = null;
    }
  }
  await page.route("**/*", async (route: Route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      control.blockedExternal.push(url.origin + path);
      return route.abort("blockedbyclient");
    }
    if (!path.startsWith("/v1/")) return route.continue();
    const endpoint = path.slice(3),
      setup = control.setup,
      state = control.state;
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ status, json });
    if (request.method() !== "GET")
      control.writes.push(request.method() + " " + endpoint);
    if (setup.loading === endpoint)
      await new Promise((resolve) => setTimeout(resolve, 3500));
    if (setup.failed === endpoint)
      return reply(
        {
          message: "Synthetic audit connection interruption. Please try again.",
        },
        503,
      );
    if (setup.unavailable === endpoint)
      return reply({ message: "This item is unavailable." }, 404);
    if (endpoint === "/demo/config")
      return reply({
        enabled: true,
        mode: setup.demoMode !== false,
        version: 1,
        groups: { men: 1, women: 1, lgbtq: 1 },
      });
    if (endpoint === "/auth/config")
      return reply({
        google: false,
        localMail: true,
        emailDelivery: true,
        otpConfigured: true,
      });
    if (endpoint === "/auth/session")
      return setup.active === false
        ? reply({ message: "Please sign in." }, 401)
        : reply({ csrfToken: "synthetic-audit-session" });
    if (endpoint === "/state") return reply(state);
    if (endpoint === "/demo/users")
      return reply({
        items: [
          {
            ...auditMe,
            demo_group: url.searchParams.get("group") || "men",
            orientation: "Straight",
            pronouns: "he/him",
            looking_for: ["Woman"],
          },
        ],
        nextCursor: null,
      });
    if (endpoint === "/auth/demo")
      return reply({ csrfToken: "synthetic-audit-session" });
    if (["/verification/send", "/auth/forgot"].includes(endpoint))
      return reply({
        sent: true,
        resendAt: new Date(Date.now() + 60000).toISOString(),
      });
    if (endpoint === "/logout") {
      control.setup.active = false;
      return reply({ ok: true });
    }
    if (endpoint.startsWith("/media/"))
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720"><rect width="600" height="720" fill="#F7E6E9"/><circle cx="300" cy="260" r="100" fill="#AA536B" opacity=".22"/><path d="M90 720Q100 390 300 390T510 720" fill="#AA536B" opacity=".35"/><text x="300" y="650" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#2C2529">SYNTHETIC AUDIT PHOTO</text></svg>',
      });
    if (endpoint.startsWith("/profiles/"))
      return reply(
        endpoint.endsWith(auditIds.me)
          ? state.me
          : endpoint.endsWith(auditIds.match)
            ? auditMatch
            : auditCandidate,
      );
    if (endpoint === "/matches")
      return reply({ items: state.matches, nextCursor: null });
    if (endpoint === "/stories")
      return reply({ items: state.stories, nextCursor: null });
    if (endpoint === "/feed")
      return reply(
        url.searchParams.get("scope") === "mine"
          ? state.feed.filter((p) => p.author.id === auditIds.me)
          : state.feed,
      );
    if (endpoint === "/saved-posts")
      return reply(state.feed.filter((p) => p.saved));
    if (endpoint.startsWith("/posts/"))
      return reply(
        state.feed.find(
          (p) =>
            p.id ===
            (setup.ownPost ? auditIds.ownPost : endpoint.split("/")[2]),
        ) || state.feed[0],
      );
    if (endpoint === "/notifications")
      return reply({ items: state.notifications, nextCursor: null });
    if (endpoint === "/blocks")
      return reply(
        setup.empty
          ? []
          : [{ id: "audit-blocked", name: "Synthetic blocked profile" }],
      );
    if (endpoint === "/reports")
      return reply(
        setup.empty
          ? []
          : [
              {
                id: "audit-report",
                reason: "Synthetic test report; no real person involved.",
                state: "open",
                resolution: null,
              },
            ],
      );
    if (endpoint.startsWith("/game-ready/"))
      return reply({ self: false, partner: false });
    if (endpoint === "/game-catalog")
      return reply({
        enabled: true,
        games: gameDefinitionsV2,
        recommendedIds: gameDefinitionsV2.slice(0, 3).map((g) => g.id),
        current:
          setup.game && ["invited", "active"].includes(setup.game.state)
            ? setup.game
            : null,
      });
    if (endpoint === "/game/" + auditIds.game)
      return setup.game
        ? reply(setup.game)
        : reply({ message: "Game unavailable." }, 404);
    if (endpoint === "/chat/" + auditIds.match) {
      const timeline = setup.empty
        ? []
        : [
            {
              id: "audit-message-1",
              type: "message",
              sender: auditIds.match,
              recipient: auditIds.me,
              body: "Coffee and a walk sounds lovely.",
              created_at: stamp,
            },
            {
              id: "audit-message-2",
              type: "message",
              sender: auditIds.me,
              recipient: auditIds.match,
              body: "How about Saturday? We could try the café near the park.",
              created_at: stamp,
            },
            {
              id: auditIds.snap,
              type: "snap",
              sender: auditIds.match,
              recipient: auditIds.me,
              opened_at: null,
              created_at: stamp,
            },
          ];
      return reply({ person: auditMatch, timeline, games: [], hasMore: false });
    }
    if (endpoint === `/snaps/${auditIds.snap}/open`)
      return reply({
        mediaId: "audit-photo",
        kind: "image",
        caption: "Synthetic snap preview.",
        viewUntil: new Date(Date.now() + 30000).toISOString(),
      });
    if (endpoint === `/snaps/${auditIds.snap}/close`)
      return reply({ ok: true });
    if (endpoint.startsWith("/chat-history/")) return reply([]);
    if (endpoint.startsWith("/discovery/")) return reply({ matched: true });
    control.unexpected.push(request.method() + " " + endpoint);
    return reply(
      { message: "Unimplemented synthetic audit endpoint: " + endpoint },
      404,
    );
  });
  return {
    ...control,
    reset,
    get current() {
      return control;
    },
  };
}
