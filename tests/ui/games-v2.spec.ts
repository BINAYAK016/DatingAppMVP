import { expect, test, type Page, type Route } from "@playwright/test";
import { gameDefinitionsV2 } from "../../apps/api/src/game-definitions";
import type {
  GameDefinitionV2,
  GameSessionV2,
} from "../../apps/mobile/src/lib/gameV2";
import type { Person, State } from "../../apps/mobile/src/lib/types";

// Every API request is intercepted. These synthetic sessions never create a
// server account, game, message, report, ready status, or provider request.
const hostId = "71000000-0000-4000-8000-000000000001";
const matchId = "71000000-0000-4000-8000-000000000002";
const otherId = "71000000-0000-4000-8000-000000000003";
const gameId = "72000000-0000-4000-8000-000000000001";
function person(id: string, name: string): Person {
  return {
    id,
    name,
    age: 29,
    city: "Kathmandu",
    bio: "Synthetic browser fixture",
    intent: "Relationship",
    interests: [],
    prompt: "",
    gender: "Woman",
    color: "#AA536B",
    demo: true,
    languages: [],
    hobbies: [],
    profession: "",
    education: "",
    lifestyle: {},
  };
}
const host = person(hostId, "Synthetic Host");
const partner = person(matchId, "Synthetic Match");
const decoy = person(otherId, "Synthetic Other Match");
const definition = (mechanic: GameDefinitionV2["mechanic"]) =>
  gameDefinitionsV2.find((game) => game.mechanic === mechanic)!;
function session(
  def: GameDefinitionV2,
  state = "active",
  overrides: Partial<GameSessionV2> = {},
): GameSessionV2 {
  const now = new Date().toISOString();
  return {
    id: gameId,
    host: hostId,
    guest: matchId,
    kind: def.id,
    version: 2,
    state,
    revision: 1,
    definition_version: def.definitionVersion,
    created_at: now,
    updated_at: now,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    accepted_at: state === "invited" ? null : now,
    definition: def,
    view: {
      phase:
        state === "invited"
          ? "closed"
          : def.mechanic === "truths"
            ? "write-truths"
            : "choices",
      canAct: state === "active",
      round: 0,
      total: def.questions.length || 2,
      question: def.questions[0],
      revealed: [],
    },
    results: null,
    complete: state === "complete",
    answered: false,
    bothAnswered: false,
    ...overrides,
  };
}
type Mutation = { path: string; body: any };
async function fixture(
  page: Page,
  options: {
    initial?: GameSessionV2;
    notification?: boolean;
    loseInviteAck?: boolean;
    loseActionAck?: boolean;
    olderInvitation?: boolean;
    holdActionReload?: boolean;
  } = {},
) {
  let current = options.initial || null;
  let unavailable = false;
  const mutations: Mutation[] = [];
  const committedInvites = new Map<string, GameSessionV2>();
  const committedActions = new Set<string>();
  let droppedInvite = false,
    droppedAction = false;
  let holdChat = false,
    reloadStatus = 200;
  let releaseReload!: () => void, reloadEntered!: () => void;
  const reloadGate = new Promise<void>((resolve) => {
    releaseReload = resolve;
  });
  const heldReload = new Promise<void>((resolve) => {
    reloadEntered = resolve;
  });
  const recentMessage = {
    id: "73000000-0000-4000-8000-000000000001",
    type: "message",
    sender: matchId,
    recipient: hostId,
    body: "Synthetic recent private conversation",
    created_at: "2026-10-01T00:00:00.000001Z",
  };
  const messages: any[] = [],
    reports: any[] = [],
    unexpected: string[] = [];
  const state: State = {
    features: { gamesV2: true },
    me: {
      ...host,
      email: "synthetic-game@example.test",
      email_verified_at: new Date().toISOString(),
      adult_declared_at: new Date().toISOString(),
      onboarded_at: new Date().toISOString(),
      onboarding_step: 5,
      birth_date: "1995-01-01",
      paused: false,
      notifications: true,
      posts_visible: true,
      stories_visible: true,
      messages_enabled: true,
      interactions_enabled: true,
      data_saver: false,
      preferences: { cities: [], genders: [], minAge: 18, maxAge: 60 },
    },
    matches: [decoy, partner],
    discover: [],
    undoId: null,
    feed: [],
    stories: [],
    games: [],
    notifications: options.notification
      ? [
          {
            id: "synthetic-game-update",
            body: "Synthetic game invitation",
            kind: "game",
            read: false,
            created_at: new Date().toISOString(),
            resource_type: "game",
            resource_id: gameId,
          },
        ]
      : [],
  };
  const fulfill = (route: Route, json: unknown, status = 200) =>
    route.fulfill({
      status,
      json,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Retry-After, X-Request-ID",
      },
    });
  await page.route("**/v1/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.slice(3),
      method = request.method();
    if (method === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
        },
      });
    if (method !== "GET")
      mutations.push({ path, body: request.postDataJSON() });
    if (path === "/auth/config")
      return fulfill(route, {
        google: false,
        emailDelivery: true,
        localMail: true,
        otpConfigured: true,
      });
    if (path === "/auth/demo")
      return fulfill(
        route,
        method === "GET" ? [host] : { token: "synthetic-browser-session-only" },
      );
    if (path === "/state") return fulfill(route, state);
    if (path === "/matches")
      return fulfill(route, {
        items: state.matches,
        hasMore: false,
        nextCursor: null,
      });
    if (path === "/notifications")
      return fulfill(route, {
        items: state.notifications,
        hasMore: false,
        nextCursor: null,
      });
    if (["/stories", "/feed"].includes(path))
      return fulfill(route, { items: [], hasMore: false, nextCursor: null });
    if (path === "/blocks") return fulfill(route, []);
    if (path === "/reports") {
      if (method === "POST")
        reports.push({
          id: "synthetic-report",
          ...request.postDataJSON(),
          state: "open",
          created_at: new Date().toISOString(),
        });
      return fulfill(
        route,
        method === "GET" ? reports : { id: "synthetic-report" },
      );
    }
    if (path.startsWith("/game-ready/"))
      return fulfill(route, { self: false, partner: false });
    if (path === "/game-catalog")
      return fulfill(route, {
        enabled: true,
        games: gameDefinitionsV2,
        recommendedIds: gameDefinitionsV2.slice(0, 3).map((game) => game.id),
        current:
          current && ["active", "invited"].includes(current.state)
            ? current
            : null,
      });
    if (path === `/games/${matchId}/invite` && method === "POST") {
      const body = request.postDataJSON();
      if (!committedInvites.has(body.clientId)) {
        current = session(
          gameDefinitionsV2.find((game) => game.id === body.kind)!,
          "invited",
        );
        committedInvites.set(body.clientId, current);
      }
      if (options.loseInviteAck && !droppedInvite) {
        droppedInvite = true;
        return route.abort("failed");
      }
      return fulfill(route, committedInvites.get(body.clientId));
    }
    if (path === `/game/${gameId}` && current)
      return unavailable
        ? fulfill(route, { message: "Synthetic game unavailable" }, 404)
        : fulfill(route, current);
    if (path === `/game/${gameId}/action` && current) {
      const body = request.postDataJSON();
      if (!committedActions.has(body.clientId)) {
        committedActions.add(body.clientId);
        if (body.action === "choice")
          current = {
            ...current,
            revision: current.revision + 1,
            view: {
              ...current.view,
              round: 1,
              question: current.definition.questions[1],
            },
          };
        else if (body.action === "accept")
          current = {
            ...current,
            state: "active",
            revision: current.revision + 1,
            view: {
              ...current.view,
              phase: "choices",
              canAct: true,
              question: current.definition.questions[0],
            },
          };
        else if (body.action === "decline")
          current = {
            ...current,
            state: "declined",
            revision: current.revision + 1,
            view: { ...current.view, phase: "closed", canAct: false },
          };
      }
      if (options.loseActionAck && !droppedAction) {
        droppedAction = true;
        return route.abort("failed");
      }
      if (options.holdActionReload) holdChat = true;
      return fulfill(route, current);
    }
    if (path.startsWith("/chat/")) {
      const target = path.split("/")[2],
        chatPartner = state.matches.find((p) => p.id === target);
      const earlier = new URL(request.url()).searchParams.has("before");
      if (method === "GET" && holdChat) {
        reloadEntered();
        await reloadGate;
        if (reloadStatus !== 200)
          return fulfill(
            route,
            { message: "Synthetic delayed conversation response" },
            reloadStatus,
          );
      }
      if (method === "POST")
        messages.push({
          id: request.postDataJSON().clientId,
          type: "message",
          sender: hostId,
          recipient: target,
          body: request.postDataJSON().body,
          created_at: new Date().toISOString(),
        });
      return fulfill(
        route,
        method === "POST"
          ? { id: messages.at(-1).id }
          : {
              person: chatPartner,
              games: current ? [current] : [],
              hasMore: !!options.olderInvitation && !earlier,
              timeline: [
                ...(current && (!options.olderInvitation || earlier)
                  ? [{ ...current, type: "game" }]
                  : []),
                ...(options.olderInvitation && !earlier ? [recentMessage] : []),
                ...messages,
              ],
            },
      );
    }
    if (path === "/notifications/read" || path === "/logout")
      return fulfill(route, { ok: true });
    unexpected.push(`${method} ${path}`);
    return fulfill(
      route,
      { message: "Unexpected synthetic fixture route" },
      404,
    );
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore demo accounts", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Try ${host.name} demo account`, exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Discover", exact: false }),
  ).toBeVisible();
  return {
    mutations,
    unexpected,
    committedInvites,
    committedActions,
    heldReload,
    releaseReload: (status = 200) => {
      reloadStatus = status;
      holdChat = false;
      releaseReload();
    },
    revoke: () => {
      unavailable = true;
    },
  };
}
async function openChat(page: Page) {
  await page.getByRole("tab", { name: "Chat", exact: false }).click();
  await page
    .getByRole("button", { name: `Chat with ${partner.name}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play together", exact: true }),
  ).toBeVisible();
}
async function openRoom(page: Page, game: GameSessionV2) {
  await openChat(page);
  await page
    .getByRole("button", {
      name: `${game.definition.title} · ${game.state}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Game safety", exact: true }),
  ).toBeVisible();
}

test("all seven games are selectable and only explicit Send Invite creates a retry-safe invitation without Ready", async ({
  page,
}) => {
  const api = await fixture(page, { loseInviteAck: true });
  await openChat(page);
  await page
    .getByRole("button", { name: "Play together", exact: true })
    .click();
  const seen = new Set<string>();
  for (const category of [
    ...new Set(gameDefinitionsV2.map((game) => game.category)),
  ]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    for (const game of gameDefinitionsV2.filter(
      (game) => game.category === category,
    )) {
      await expect(
        page.getByRole("button", { name: `Play ${game.title}`, exact: true }),
      ).toBeEnabled();
      seen.add(game.id);
    }
  }
  expect(seen.size).toBe(7);
  const game = definition("choices");
  await page.getByRole("button", { name: game.category, exact: true }).click();
  await page
    .getByRole("button", { name: `Play ${game.title}`, exact: true })
    .click();
  const send = page.getByRole("button", { name: "Send Invite", exact: true });
  await expect(send).toBeEnabled();
  expect(api.mutations.filter((m) => m.path.endsWith("/invite"))).toHaveLength(
    0,
  );
  await send.click();
  await expect(
    page.getByText(/Check your conversation or retry this invitation/),
  ).toBeVisible();
  await expect(send).toBeEnabled();
  await send.click();
  await expect(
    page.getByText("Your invitation is waiting", { exact: true }),
  ).toBeVisible();
  const invites = api.mutations.filter((m) => m.path.endsWith("/invite"));
  expect(invites).toHaveLength(2);
  expect(invites[0].body).toEqual(invites[1].body);
  expect(invites[0].body.kind).toBe(game.id);
  expect(invites[0].body.clientId).toMatch(/^[a-f0-9-]{36}$/);
  expect(api.committedInvites.size).toBe(1);
  expect(
    api.mutations.filter(
      (m) => m.path.startsWith("/game-ready/") && m.body?.enabled === true,
    ),
  ).toHaveLength(0);
  expect(api.unexpected).toEqual([]);
});

test("an unsent room draft restores after leaving and reopening without publishing private statements", async ({
  page,
}) => {
  const game = session(definition("truths"));
  const api = await fixture(page, { initial: game });
  await openRoom(page, game);
  const statements = [
    "Synthetic favourite mountain",
    "Synthetic cooking story",
    "Synthetic invented adventure",
  ];
  for (const [index, value] of statements.entries())
    await page
      .getByLabel(`Statement ${index + 1}`, { exact: true })
      .fill(value);
  await page
    .getByRole("button", { name: "Statement 2 is the lie", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lock in my statements", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          sessionStorage.getItem(
            `sangai.game-draft.v2.${id.account}.${id.game}`,
          ),
        { account: hostId, game: gameId },
      ),
    )
    .toContain(statements[0]);
  await page
    .getByRole("button", { name: "Back to conversation", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/chat/${matchId}$`));
  await page
    .getByRole("button", { name: "Play together", exact: true })
    .click();
  await page.getByRole("button", { name: "Resume game", exact: true }).click();
  for (const [index, value] of statements.entries())
    await expect(
      page.getByLabel(`Statement ${index + 1}`, { exact: true }),
    ).toHaveValue(value);
  await expect(
    page.getByRole("button", { name: "Lock in my statements", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        (id) => {
          const saved = sessionStorage.getItem(
            `sangai.game-draft.v2.${id.account}.${id.game}`,
          );
          return saved ? JSON.parse(saved).data.form.lie : null;
        },
        { account: hostId, game: gameId },
      ),
    )
    .toBe(1);
  expect(api.mutations.filter((m) => m.path.endsWith("/action"))).toHaveLength(
    0,
  );
  expect(api.unexpected).toEqual([]);
});

test("an acknowledged-on-server action retries its original id and payload after a lost response", async ({
  page,
}) => {
  const game = session(definition("choices"));
  const api = await fixture(page, { initial: game, loseActionAck: true });
  await openRoom(page, game);
  await page
    .getByRole("button", {
      name: game.definition.questions[0].options[0].label,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Lock in my answer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry last action", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Retry last action", exact: true })
    .click();
  await expect(
    page.getByText(game.definition.questions[1].q, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry last action", exact: true }),
  ).toHaveCount(0);
  const actions = api.mutations.filter((m) => m.path.endsWith("/action"));
  expect(actions).toHaveLength(2);
  expect(actions[1].body.clientId).toBe(actions[0].body.clientId);
  expect(actions[1].body.payload).toEqual(actions[0].body.payload);
  expect(actions[1].body.expectedRevision).toBe(2);
  expect(api.committedActions.size).toBe(1);
  expect(api.unexpected).toEqual([]);
});

test("an unavailable game clears its private draft and reopening cannot resurrect it", async ({
  page,
}) => {
  const game = session(definition("truths"));
  const api = await fixture(page, { initial: game });
  await openRoom(page, game);
  await page
    .getByLabel("Statement 1", { exact: true })
    .fill("Synthetic private unsent statement");
  const stored = () =>
    page.evaluate(
      (id) =>
        sessionStorage.getItem(`sangai.game-draft.v2.${id.account}.${id.game}`),
      { account: hostId, game: gameId },
    );
  await expect.poll(stored).toContain("Synthetic private unsent statement");
  api.revoke();
  await expect(page.getByText("Game unavailable", { exact: true })).toBeVisible(
    { timeout: 12000 },
  );
  await expect(page.getByLabel("Statement 1", { exact: true })).toHaveCount(0);
  await expect.poll(stored).toBeNull();
  await page.getByRole("button", { name: "Back to Chat", exact: true }).click();
  await page
    .getByRole("button", { name: `Chat with ${partner.name}`, exact: true })
    .click();
  await page
    .getByRole("button", {
      name: `${game.definition.title} · ${game.state}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Game unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Statement 1", { exact: true })).toHaveCount(0);
  await expect.poll(stored).toBeNull();
  expect(api.mutations.filter((m) => m.path.endsWith("/action"))).toHaveLength(
    0,
  );
  expect(api.unexpected).toEqual([]);
});

test("Talk about it fills the correct conversation and sends only after an explicit Send message", async ({
  page,
}) => {
  const prompt =
    "Synthetic conversation starter: what made that place special?";
  const game = session(definition("choices"), "complete", {
    results: {
      heading: "Synthetic shared favourites",
      conversationPrompt: prompt,
      agree: [],
      different: [],
      reveals: [],
    },
    view: { phase: "closed", canAct: false, round: 5, total: 5, revealed: [] },
  });
  const api = await fixture(page, { initial: game });
  await openRoom(page, game);
  await page
    .getByRole("button", { name: "Talk about it", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/chat/${matchId}$`));
  const composer = page.getByRole("textbox", {
    name: "A thought, a question, a hello…",
    exact: true,
  });
  await expect(composer).toHaveValue(prompt);
  expect(api.mutations.filter((m) => m.path.startsWith("/chat/"))).toHaveLength(
    0,
  );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText(prompt, { exact: true })).toBeVisible();
  const sent = api.mutations.filter((m) => m.path.startsWith("/chat/"));
  expect(sent).toHaveLength(1);
  expect(sent[0].path).toBe(`/chat/${matchId}`);
  expect(sent[0].body.body).toBe(prompt);
  expect(api.unexpected).toEqual([]);
});

test("Talk about it preserves an existing unsent conversation draft without sending either text", async ({
  page,
}) => {
  const draft = "Synthetic unsent original conversation draft";
  const prompt = "Synthetic game starter that must not replace the draft";
  const game = session(definition("choices"), "complete", {
    results: {
      heading: "Synthetic shared favourites",
      conversationPrompt: prompt,
      agree: [],
      different: [],
      reveals: [],
    },
    view: { phase: "closed", canAct: false, round: 5, total: 5, revealed: [] },
  });
  const api = await fixture(page, { initial: game });
  await openChat(page);
  const composer = page.getByRole("textbox", {
    name: "A thought, a question, a hello…",
    exact: true,
  });
  await composer.fill(draft);
  await page
    .getByRole("button", {
      name: `${game.definition.title} · complete`,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Talk about it", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/chat/${matchId}$`));
  expect(
    api.mutations.filter(
      (m) => m.path.startsWith("/chat/") || m.path.startsWith("/messages"),
    ),
  ).toHaveLength(0);
  expect(api.unexpected).toEqual([]);
  await expect(composer).toHaveValue(draft);
});

test("an id-only game notification derives its partner and carries that game into private Safety reporting", async ({
  page,
}) => {
  const game = session(definition("choices"), "invited", {
    host: matchId,
    guest: hostId,
  });
  const api = await fixture(page, { initial: game, notification: true });
  await page.getByRole("tab", { name: "Chat", exact: false }).click();
  await page
    .getByRole("button", { name: "Open activity", exact: true })
    .click();
  await page.getByRole("button", { name: "Open game", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/game/${gameId}\\?version=2$`));
  await expect(
    page.getByText(`You + ${partner.name}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Let’s Play ❤️", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Game safety", exact: true }).click();
  const safety = new URL(page.url());
  expect(safety.pathname).toBe("/safety");
  expect(safety.searchParams.get("target")).toBe(matchId);
  expect(safety.searchParams.get("gameId")).toBe(gameId);
  expect(safety.searchParams.get("context")).toBe("game");
  await page
    .getByRole("button", { name: "Submit a private report", exact: true })
    .click();
  await page
    .getByLabel("Tell us what happened", { exact: true })
    .fill("Synthetic game safety concern");
  await page
    .getByRole("button", { name: "Submit a private report", exact: true })
    .last()
    .click();
  await expect
    .poll(() => api.mutations.filter((m) => m.path === "/reports"))
    .toHaveLength(1);
  expect(api.mutations.find((m) => m.path === "/reports")?.body).toMatchObject({
    target: matchId,
    gameId,
    context: "game",
    reason: "Synthetic game safety concern",
  });
  expect(api.unexpected).toEqual([]);
});

for (const response of ["accept", "decline"] as const) {
  test(`an older-history invitation updates after explicit ${response} although the latest page contains no game`, async ({
    page,
  }) => {
    const game = session(definition("choices"), "invited", {
      host: matchId,
      guest: hostId,
      created_at: "2026-09-30T00:00:00.000001Z",
    });
    const api = await fixture(page, {
      initial: game,
      olderInvitation: true,
      holdActionReload: response === "accept",
    });
    await openChat(page);
    await expect(
      page.getByRole("button", { name: "Accept & play", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Earlier conversation", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Accept & play", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", {
        name: response === "accept" ? "Accept & play" : "Maybe later",
        exact: true,
      })
      .click();
    if (response === "accept") {
      await api.heldReload;
      await expect(
        page.getByRole("button", {
          name: `${game.definition.title} · active`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Accept & play", exact: true }),
      ).toHaveCount(0);
      api.releaseReload();
      await expect(page).toHaveURL(new RegExp(`/game/${gameId}`));
      await expect(
        page.getByText(game.definition.questions[0].q, { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Back to conversation", exact: true })
        .click();
      const earlier = page.getByRole("button", {
        name: "Earlier conversation",
        exact: true,
      });
      await expect(
        page.getByRole("button", { name: "Play together", exact: true }),
      ).toBeVisible();
      if (await earlier.count()) await earlier.click();
    }
    await expect(page).toHaveURL(new RegExp(`/chat/${matchId}$`));
    await expect(
      page.getByRole("button", { name: "Accept & play", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Maybe later", exact: true }),
    ).toHaveCount(0);
    const card = page.getByRole("button", {
      name: `${game.definition.title} · ${response === "accept" ? "active" : "declined"}`,
      exact: true,
    });
    await expect(card).toBeVisible();
    const actions = api.mutations.filter((m) => m.path.endsWith("/action"));
    expect(actions).toHaveLength(1);
    expect(actions[0].body.action).toBe(response);
    expect(api.unexpected).toEqual([]);
  });
}

for (const status of [503, 404, 401]) {
  test(`a delayed ${status} reload after inline acceptance cannot navigate to an old game`, async ({
    page,
  }) => {
    const game = session(definition("choices"), "invited", {
      host: matchId,
      guest: hostId,
    });
    const api = await fixture(page, { initial: game, holdActionReload: true });
    await openChat(page);
    const composer = page.getByRole("textbox", {
      name: "A thought, a question, a hello…",
      exact: true,
    });
    await composer.fill("Synthetic private unsent draft");
    const gameNavigations: string[] = [];
    page.on("framenavigated", (frame) => {
      if (
        frame === page.mainFrame() &&
        new URL(frame.url()).pathname.startsWith("/game/")
      )
        gameNavigations.push(frame.url());
    });
    await page
      .getByRole("button", { name: "Accept & play", exact: true })
      .click();
    await api.heldReload;
    api.releaseReload(status);
    if (status === 503) {
      await expect(
        page.getByRole("button", { name: "Reconnect", exact: true }),
      ).toBeVisible();
      await expect(composer).toHaveValue("Synthetic private unsent draft");
      await expect(page).toHaveURL(new RegExp(`/chat/${matchId}$`));
      expect(gameNavigations).toEqual([]);
      await page
        .getByRole("button", { name: "Reconnect", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Reconnect", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", {
          name: `${game.definition.title} · active`,
          exact: true,
        })
        .click();
      await expect(
        page.getByText(game.definition.questions[0].q, { exact: true }),
      ).toBeVisible();
    } else {
      await expect(composer).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Play together", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: `${game.definition.title} · active`,
          exact: true,
        }),
      ).toHaveCount(0);
      if (status === 401)
        await expect(
          page.getByRole("button", {
            name: "Explore demo accounts",
            exact: true,
          }),
        ).toBeVisible();
      else
        await expect(
          page.getByRole("button", { name: "Retry", exact: true }),
        ).toBeVisible();
      expect(gameNavigations).toEqual([]);
    }
    expect(
      api.mutations.filter((m) => m.path.endsWith("/action")),
    ).toHaveLength(1);
    expect(
      api.mutations.filter((m) => m.path.startsWith("/chat/")),
    ).toHaveLength(0);
    expect(api.unexpected).toEqual([]);
  });
}
