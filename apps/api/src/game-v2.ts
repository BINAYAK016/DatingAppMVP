import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { DB, one, requireMatch, rows, tx } from "./db";
import {
  definitionFor,
  gameDefinitionsV2,
  GameDefinitionV2,
  GameQuestion,
} from "./game-definitions";
import { text } from "./validation";

type TruthTurn = {
  author: string;
  statements?: string[];
  lie?: number;
  guess?: number;
};
type GuessTurn = { author: string; answer?: string; guess?: string };
type QuestionTurn = { asker: string; question?: string; answer?: string };
export type GameDataV2 = {
  choices: Record<string, Record<string, string>>;
  finished: Record<string, boolean>;
  timers: Record<string, string>;
  truths: TruthTurn[];
  guesses: GuessTurn[];
  questions: QuestionTurn[];
};
export type GameResultV2 = {
  heading: string;
  conversationPrompt: string;
  agree: { question: string; choice: string }[];
  different: { question: string; you: string; partner: string }[];
  reveals: { title: string; body: string }[];
  same?: number;
  compared?: number;
};
export type GameViewV2 = {
  phase:
    | "choices"
    | "start-timer"
    | "waiting"
    | "write-truths"
    | "guess-truths"
    | "set-answer"
    | "guess-answer"
    | "ask"
    | "respond"
    | "closed";
  canAct: boolean;
  question?: GameQuestion;
  round: number;
  total: number;
  myChoices?: Record<string, string>;
  deadline?: string;
  statements?: string[];
  prompt?: string;
  revealed: { title: string; body: string }[];
};
export type GameSessionV2 = {
  id: string;
  host: string;
  guest: string;
  kind: string;
  version: 2;
  state: string;
  revision: number;
  definition_version: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  accepted_at: string | null;
  definition: GameDefinitionV2;
  view: GameViewV2;
  results: GameResultV2 | null;
  complete: boolean;
  answered: boolean;
  bothAnswered: boolean;
};
export const gamesV2Enabled = () => process.env.ENABLE_GAMES_V2 === "true";
const requireEnabled = () => {
  if (!gamesV2Enabled())
    throw new NotFoundException("Games 2.0 is not enabled on this server.");
};
const iso = (value: string | Date) => new Date(value).toISOString();
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
const other = (g: any, actor: string) => (actor === g.host ? g.guest : g.host);
const definition = (g: any) => {
  const d = definitionFor(g.kind, g.definition_version);
  if (!d)
    throw new ConflictException("This game needs a supported app version.");
  return d;
};
export function initialGameData(
  host: string,
  guest: string,
  d: GameDefinitionV2,
): GameDataV2 {
  return {
    choices: { [host]: {}, [guest]: {} },
    finished: {},
    timers: {},
    truths: [{ author: host }, { author: guest }],
    guesses: d.questions.map((_, i) => ({ author: i % 2 ? guest : host })),
    questions: Array.from({ length: 20 }, (_, i) => ({
      asker: i % 2 ? guest : host,
    })),
  };
}
function compareChoices(g: any, actor: string): GameResultV2 {
  const d = definition(g),
    data = g.state_data as GameDataV2;
  const agree: GameResultV2["agree"] = [],
    different: GameResultV2["different"] = [];
  for (const q of d.questions) {
    const a = data.choices[actor]?.[q.id],
      b = data.choices[other(g, actor)]?.[q.id];
    if (a === undefined || b === undefined) continue;
    const label = (id: string) =>
      q.options.find((o) => o.id === id)?.label || "";
    if (a === b) agree.push({ question: q.q, choice: label(a) });
    else different.push({ question: q.q, you: label(a), partner: label(b) });
  }
  return {
    heading:
      d.mechanic === "rapid"
        ? agree.length + different.length
          ? `Same choices on ${agree.length}/${agree.length + different.length}`
          : "No shared answers this round."
        : "A little more to talk about.",
    conversationPrompt: agree.length
      ? `You both picked ${agree[0].choice}. Tell them why.`
      : "Which answer surprised you? Ask them about it.",
    agree,
    different,
    reveals: [],
    same: agree.length,
    compared: agree.length + different.length,
  };
}
function revealedTurns(g: any): GameResultV2["reveals"] {
  const d = definition(g),
    data = g.state_data as GameDataV2;
  if (d.mechanic === "truths")
    return data.truths.flatMap((t, i) =>
      t.guess === undefined
        ? []
        : [
            {
              title: `Round ${i + 1}: ${t.guess === t.lie ? "Correct guess ❤️" : "A little surprise 😂"}`,
              body: `The invented statement was #${(t.lie ?? 0) + 1}: ${t.statements?.[t.lie ?? 0]}. The guess was #${t.guess + 1}.`,
            },
          ],
    );
  if (d.mechanic === "guess")
    return data.guesses.flatMap((t, i) =>
      t.guess === undefined
        ? []
        : [
            {
              title: `${d.questions[i].q} · ${t.guess === t.answer ? "Correct ❤️" : "Now you know 😂"}`,
              body: `Answer: ${d.questions[i].options.find((o) => o.id === t.answer)?.label}. Guess: ${d.questions[i].options.find((o) => o.id === t.guess)?.label}.`,
            },
          ],
    );
  if (d.mechanic === "questions")
    return data.questions.flatMap((t) =>
      t.answer === undefined
        ? []
        : [{ title: t.question || "Question", body: t.answer }],
    );
  return [];
}
export function gameResultsV2(g: any, actor: string): GameResultV2 {
  const d = definition(g);
  if (d.mechanic === "choices" || d.mechanic === "rapid")
    return compareChoices(g, actor);
  return {
    heading: "That was fun.",
    conversationPrompt: "Tell them about an answer that surprised you.",
    agree: [],
    different: [],
    reveals: revealedTurns(g),
  };
}
export function projectGameV2(g: any, actor: string): GameSessionV2 {
  const d = definition(g),
    data = g.state_data as GameDataV2;
  const state =
    ["invited", "active"].includes(g.state) &&
    new Date(g.expires_at).getTime() <= Date.now()
      ? "expired"
      : g.state;
  const view: GameViewV2 = {
    phase: "closed",
    canAct: false,
    round: 0,
    total: d.questions.length || (d.mechanic === "questions" ? 20 : 2),
    revealed: [],
  };
  if (state === "active") {
    if (d.mechanic === "choices" || d.mechanic === "rapid") {
      const mine = data.choices[actor] || {};
      view.round = Object.keys(mine).length;
      view.myChoices = mine;
      view.deadline = data.timers[actor];
      view.question = d.questions.find((q) => mine[q.id] === undefined);
      view.phase = data.finished[actor]
        ? "waiting"
        : d.mechanic === "rapid" && !data.timers[actor]
          ? "start-timer"
          : "choices";
      view.canAct = view.phase !== "waiting";
      const shared = compareChoices(g, actor);
      view.revealed = [
        ...shared.agree.map((a) => ({
          title: a.question,
          body: `You both picked ${a.choice}.`,
        })),
        ...shared.different.map((a) => ({
          title: a.question,
          body: `You: ${a.you} · Your match: ${a.partner}`,
        })),
      ];
    } else if (d.mechanic === "truths") {
      const index = data.truths.findIndex((t) => t.guess === undefined),
        t = data.truths[index];
      view.round = index;
      if (t) {
        view.phase = t.statements
          ? t.author === actor
            ? "waiting"
            : "guess-truths"
          : t.author === actor
            ? "write-truths"
            : "waiting";
        view.statements = t.statements;
        view.canAct = view.phase !== "waiting";
      }
      view.revealed = revealedTurns(g);
    } else if (d.mechanic === "guess") {
      const index = data.guesses.findIndex((t) => t.guess === undefined),
        t = data.guesses[index];
      view.round = index;
      view.question = d.questions[index];
      if (t) {
        view.phase =
          t.answer === undefined
            ? t.author === actor
              ? "set-answer"
              : "waiting"
            : t.author === actor
              ? "waiting"
              : "guess-answer";
        view.canAct = view.phase !== "waiting";
      }
      view.revealed = revealedTurns(g);
    } else {
      const index = data.questions.findIndex((t) => t.answer === undefined),
        t = data.questions[index];
      view.round = index;
      if (t) {
        view.phase = t.question
          ? t.asker === actor
            ? "waiting"
            : "respond"
          : t.asker === actor
            ? "ask"
            : "waiting";
        view.prompt = t.question;
        view.canAct = view.phase !== "waiting";
      }
      view.revealed = revealedTurns(g);
    }
  }
  return {
    id: g.id,
    host: g.host,
    guest: g.guest,
    kind: g.kind,
    version: 2,
    state,
    revision: g.revision,
    definition_version: g.definition_version,
    created_at: iso(g.created_at),
    updated_at: iso(g.updated_at),
    expires_at: iso(g.expires_at),
    accepted_at: g.accepted_at ? iso(g.accepted_at) : null,
    definition: d,
    view,
    results: state === "complete" ? gameResultsV2(g, actor) : null,
    complete: state === "complete",
    answered: !!data.finished[actor],
    bothAnswered: !!data.finished[g.host] && !!data.finished[g.guest],
  };
}
export function gameExportV2(g: any, actor: string) {
  const data = g.state_data as GameDataV2;
  return {
    id: g.id,
    kind: g.kind,
    version: 2,
    state: g.state,
    created_at: g.created_at,
    my_choices: data.choices[actor] || {},
    my_statements: data.truths
      .filter((t) => t.author === actor)
      .map((t) => ({ statements: t.statements, lie: t.lie })),
    my_truth_guesses: data.truths
      .filter((t) => t.author !== actor)
      .map((t) => t.guess),
    my_answers: data.guesses
      .filter((t) => t.author === actor)
      .map((t) => t.answer),
    my_guesses: data.guesses
      .filter((t) => t.author !== actor)
      .map((t) => t.guess),
    my_questions: data.questions
      .filter((t) => t.asker === actor)
      .map((t) => t.question),
    my_responses: data.questions
      .filter((t) => t.asker !== actor)
      .map((t) => t.answer),
  };
}
async function lockPair(db: DB, a: string, b: string) {
  await db.query(
    "SELECT a FROM connections WHERE a=LEAST($1::uuid,$2::uuid) AND b=GREATEST($1::uuid,$2::uuid) FOR UPDATE",
    [a, b],
  );
  await requireMatch(db, a, b);
}
async function load(db: DB, actor: string, id: string) {
  const info = await one(
    db,
    "SELECT host,guest,version FROM games WHERE id=$1",
    [id],
  );
  if (!info || info.version !== 2 || ![info.host, info.guest].includes(actor))
    throw new NotFoundException("Game unavailable.");
  await lockPair(db, info.host, info.guest);
  return one(db, "SELECT * FROM games WHERE id=$1 FOR UPDATE", [id]);
}
async function event(
  db: DB,
  g: any,
  actor: string | null,
  type: string,
  clientId: string,
  payload: unknown,
  signature = hash({ action: type, payload }),
) {
  g.revision++;
  await db.query(
    "INSERT INTO game_events(id,game_id,sequence,actor,type,client_id,payload_hash,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      randomUUID(),
      g.id,
      g.revision,
      actor,
      type,
      clientId,
      signature,
      JSON.stringify(payload),
    ],
  );
}
async function notification(
  db: DB,
  g: any,
  recipient: string,
  actor: string,
  suffix: string,
  body: string,
) {
  await db.query(
    "INSERT INTO notifications(id,recipient,actor,kind,body,resource_type,resource_id,dedupe_key) VALUES($1,$2,$3,'game',$4,'game',$5,$6) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING",
    [
      randomUUID(),
      recipient,
      actor,
      body,
      g.id,
      `game:${g.id}:${suffix}:${recipient}`,
    ],
  );
}
async function save(db: DB, g: any) {
  g.updated_at = new Date();
  const data = g.state_data as GameDataV2;
  const deadlines = [
    new Date(g.expires_at).getTime(),
    ...Object.entries(data.timers)
      .filter(([actor]) => !data.finished[actor])
      .map(([, deadline]) => new Date(deadline).getTime()),
  ];
  const nextTick = ["invited", "active"].includes(g.state)
    ? new Date(Math.min(...deadlines))
    : null;
  await db.query(
    "UPDATE games SET state=$2,state_data=$3,revision=$4,expires_at=$5,accepted_at=$6,updated_at=$7,next_tick_at=$8 WHERE id=$1",
    [
      g.id,
      g.state,
      JSON.stringify(g.state_data),
      g.revision,
      g.expires_at,
      g.accepted_at,
      g.updated_at,
      nextTick,
    ],
  );
  if (g.state === "complete") {
    await db.query(
      "INSERT INTO game_results(game_id,definition_version,summary) VALUES($1,$2,$3) ON CONFLICT(game_id) DO NOTHING",
      [
        g.id,
        g.definition_version,
        JSON.stringify({
          [g.host]: gameResultsV2(g, g.host),
          [g.guest]: gameResultsV2(g, g.guest),
        }),
      ],
    );
    await notification(
      db,
      g,
      g.host,
      g.guest,
      "complete",
      "Your game reveal is ready.",
    );
    await notification(
      db,
      g,
      g.guest,
      g.host,
      "complete",
      "Your game reveal is ready.",
    );
  }
}
async function reconcile(db: DB, g: any) {
  if (!["invited", "active"].includes(g.state)) return;
  if (new Date(g.expires_at).getTime() <= Date.now()) {
    g.state = "expired";
    await event(db, g, null, "expired", "system-expiry", {});
    await save(db, g);
  } else if (g.state === "active" && definition(g).mechanic === "rapid") {
    const data = g.state_data as GameDataV2;
    let changed = false;
    for (const actor of [g.host, g.guest]) {
      if (
        data.timers[actor] &&
        !data.finished[actor] &&
        new Date(data.timers[actor]).getTime() <= Date.now()
      ) {
        data.finished[actor] = true;
        await event(db, g, null, "timer-ended", `timer:${actor}`, {});
        changed = true;
      }
    }
    if (data.finished[g.host] && data.finished[g.guest]) g.state = "complete";
    if (changed) await save(db, g);
  }
}
export async function catalog(actor: string, target?: string) {
  if (!gamesV2Enabled())
    return { enabled: false, games: [], recommendedIds: [], current: null };
  return tx(async (db) => {
    if (target) await requireMatch(db, actor, target);
    const count = target
      ? await one(
          db,
          "SELECT count(*)::int AS n FROM (SELECT id FROM messages WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1) LIMIT 10) sample",
          [actor, target],
        )
      : { n: 0 };
    const current = target
      ? await one(
          db,
          "SELECT * FROM games WHERE ((host=$1 AND guest=$2) OR (host=$2 AND guest=$1)) AND state IN ('invited','active') AND expires_at>now() ORDER BY created_at DESC LIMIT 1",
          [actor, target],
        )
      : null;
    return {
      enabled: true,
      games: gameDefinitionsV2,
      recommendedIds:
        count.n < 10
          ? [
              "this-or-that",
              "two-truths",
              "would-you-rather",
              "guess-my-answer",
            ]
          : [
              "compatibility-challenge",
              "rapid-fire",
              "guess-my-answer",
              "20-questions",
            ],
      current:
        current?.version === 2
          ? projectGameV2(current, actor)
          : current
            ? {
                id: current.id,
                version: current.version,
                kind: current.kind,
                state: current.state,
              }
            : null,
    };
  });
}
export async function invite(actor: string, target: string, body: unknown) {
  requireEnabled();
  const input = z
    .object({ kind: text(40), clientId: text(100) })
    .strict()
    .parse(body);
  const d = definitionFor(input.kind);
  if (!d) throw new BadRequestException("Unknown game.");
  return tx(async (db) => {
    await lockPair(db, actor, target);
    const signature = hash({ target, kind: input.kind });
    const replay = await one(
      db,
      "SELECT * FROM games WHERE host=$1 AND client_id=$2 AND version=2 FOR UPDATE",
      [actor, input.clientId],
    );
    if (replay) {
      if (replay.invite_hash !== signature)
        throw new ConflictException(
          "Retry this invitation with its original choices.",
        );
      await reconcile(db, replay);
      return projectGameV2(replay, actor);
    }
    const expired = await rows(
      db,
      "SELECT * FROM games WHERE version=2 AND LEAST(host,guest)=LEAST($1::uuid,$2::uuid) AND GREATEST(host,guest)=GREATEST($1::uuid,$2::uuid) AND state IN ('invited','active') AND expires_at<=now() ORDER BY created_at LIMIT 20 FOR UPDATE",
      [actor, target],
    );
    for (const old of expired) await reconcile(db, old);
    await db.query(
      "UPDATE games SET state='expired',updated_at=now() WHERE version<>2 AND ((host=$1 AND guest=$2) OR (host=$2 AND guest=$1)) AND state IN ('invited','active') AND expires_at<=now()",
      [actor, target],
    );
    const prior = await one(
      db,
      "SELECT id FROM games WHERE ((host=$1 AND guest=$2) OR (host=$2 AND guest=$1)) AND state IN ('invited','active') AND expires_at>now()",
      [actor, target],
    );
    if (prior)
      throw new ConflictException("Resume or cancel your current game first.");
    const g = await one(
      db,
      "INSERT INTO games(id,host,guest,kind,version,definition_version,expires_at,client_id,invite_hash,state_data) VALUES($1,$2,$3,$4,2,$5,now()+interval '24 hours',$6,$7,$8) RETURNING *",
      [
        randomUUID(),
        actor,
        target,
        d.id,
        d.definitionVersion,
        input.clientId,
        signature,
        JSON.stringify(initialGameData(actor, target, d)),
      ],
    );
    await event(db, g, actor, "invited", input.clientId, { kind: d.id });
    await save(db, g);
    await notification(
      db,
      g,
      target,
      actor,
      "invited",
      `A match invited you to ${d.title}.`,
    );
    return projectGameV2(g, actor);
  });
}
export async function read(actor: string, id: string) {
  return tx(async (db) => {
    const g = await load(db, actor, id);
    await reconcile(db, g);
    return projectGameV2(g, actor);
  });
}
// Bounded, idempotent cleanup; never publishes unrevealed private answers.
// The beta's shared transaction lock also serializes this with block/unmatch.
export async function reconcileExpiredGamesV2() {
  return tx(async (db) => {
    const due = await rows(
      db,
      "SELECT * FROM games WHERE version=2 AND state IN ('invited','active') AND next_tick_at<=now() ORDER BY next_tick_at,id LIMIT 50 FOR UPDATE SKIP LOCKED",
    );
    for (const g of due) await reconcile(db, g);
    return due.length;
  });
}
const envelope = z
  .object({
    clientId: text(100),
    expectedRevision: z.number().int().min(0),
    action: z.enum([
      "accept",
      "decline",
      "cancel",
      "choice",
      "start-timer",
      "finish",
      "submit-truths",
      "guess",
      "set-answer",
      "ask",
      "respond",
    ]),
    payload: z.unknown().optional().default({}),
  })
  .strict();
export function applyGameAction(
  g: any,
  actor: string,
  actionName: string,
  payload: unknown,
  now = Date.now(),
) {
  if (![g.host, g.guest].includes(actor))
    throw new ForbiddenException("Only these two players can play.");
  const d = definition(g),
    data = g.state_data as GameDataV2;
  if (["accept", "decline", "cancel"].includes(actionName)) {
    z.object({}).strict().parse(payload);
    if (!["invited", "active"].includes(g.state))
      throw new ConflictException("This game is closed.");
    if (actionName !== "cancel" && (actor !== g.guest || g.state !== "invited"))
      throw new ForbiddenException(
        "Only the invited match can accept or decline.",
      );
    if (actionName === "accept") {
      g.state = "active";
      g.accepted_at = new Date(now);
      g.expires_at = new Date(now + 7 * 86400000);
    } else g.state = actionName === "decline" ? "declined" : "cancelled";
    return {};
  }
  if (g.state !== "active")
    throw new ConflictException("Accept this invitation before playing.");
  if (d.mechanic === "choices" || d.mechanic === "rapid") {
    if (data.finished[actor])
      throw new ConflictException("Your round is already finished.");
    if (actionName === "start-timer" && d.mechanic === "rapid") {
      z.object({}).strict().parse(payload);
      if (data.timers[actor])
        throw new ConflictException("Your timer already started.");
      data.timers[actor] = new Date(now + 90000).toISOString();
      return {};
    }
    if (
      d.mechanic === "rapid" &&
      (!data.timers[actor] || new Date(data.timers[actor]).getTime() <= now)
    )
      throw new ConflictException(
        "Your timed round has ended or has not started.",
      );
    if (actionName === "finish" && d.mechanic === "rapid") {
      z.object({}).strict().parse(payload);
      data.finished[actor] = true;
      if (data.finished[g.host] && data.finished[g.guest]) g.state = "complete";
      return {};
    }
    if (actionName !== "choice")
      throw new BadRequestException("Choose an answer for this game.");
    const input = z
      .object({ questionId: text(60), choiceId: text(10) })
      .strict()
      .parse(payload);
    const q = d.questions.find((q) => data.choices[actor][q.id] === undefined);
    if (
      !q ||
      q.id !== input.questionId ||
      !q.options.some((o) => o.id === input.choiceId)
    )
      throw new ConflictException("This question changed. Refresh your game.");
    data.choices[actor][q.id] = input.choiceId;
    if (Object.keys(data.choices[actor]).length === d.questions.length)
      data.finished[actor] = true;
    if (data.finished[g.host] && data.finished[g.guest]) g.state = "complete";
    return input;
  }
  if (d.mechanic === "truths") {
    const index = data.truths.findIndex((t) => t.guess === undefined),
      turn = data.truths[index];
    if (!turn) throw new ConflictException("These rounds are finished.");
    if (
      actionName === "submit-truths" &&
      turn.author === actor &&
      !turn.statements
    ) {
      const input = z
        .object({
          round: z.number().int(),
          statements: z
            .array(text(180))
            .length(3)
            .refine(
              (s) => new Set(s.map((v) => v.toLowerCase())).size === 3,
              "Use three different statements.",
            ),
          lie: z.number().int().min(0).max(2),
        })
        .strict()
        .parse(payload);
      if (input.round !== index)
        throw new ConflictException("This round changed. Refresh your game.");
      turn.statements = input.statements;
      turn.lie = input.lie;
      return input;
    }
    if (actionName === "guess" && turn.author !== actor && turn.statements) {
      const input = z
        .object({
          round: z.number().int(),
          value: z.number().int().min(0).max(2),
        })
        .strict()
        .parse(payload);
      if (input.round !== index)
        throw new ConflictException("This round changed. Refresh your game.");
      turn.guess = input.value;
      if (data.truths.every((t) => t.guess !== undefined)) g.state = "complete";
      return input;
    }
  } else if (d.mechanic === "guess") {
    const index = data.guesses.findIndex((t) => t.guess === undefined),
      turn = data.guesses[index];
    const q = d.questions[index];
    if (!turn || !q) throw new ConflictException("These rounds are finished.");
    const input = z
      .object({ round: z.number().int(), choiceId: text(10) })
      .strict()
      .parse(payload);
    if (
      input.round !== index ||
      !q.options.some((o) => o.id === input.choiceId)
    )
      throw new ConflictException("This round changed. Refresh your game.");
    if (
      actionName === "set-answer" &&
      turn.author === actor &&
      turn.answer === undefined
    )
      turn.answer = input.choiceId;
    else if (
      actionName === "guess" &&
      turn.author !== actor &&
      turn.answer !== undefined
    )
      turn.guess = input.choiceId;
    else throw new ForbiddenException("Wait for your turn.");
    if (data.guesses.every((t) => t.guess !== undefined)) g.state = "complete";
    return input;
  } else {
    const index = data.questions.findIndex((t) => t.answer === undefined),
      turn = data.questions[index];
    if (!turn) throw new ConflictException("These questions are finished.");
    const input = z
      .object({
        round: z.number().int(),
        text: text(actionName === "ask" ? 180 : 500),
      })
      .strict()
      .parse(payload);
    if (input.round !== index)
      throw new ConflictException("This turn changed. Refresh your game.");
    if (actionName === "ask" && turn.asker === actor && !turn.question)
      turn.question = input.text;
    else if (actionName === "respond" && turn.asker !== actor && turn.question)
      turn.answer = input.text;
    else throw new ForbiddenException("Wait for your turn.");
    if (data.questions.every((t) => t.answer !== undefined))
      g.state = "complete";
    return input;
  }
  throw new ForbiddenException("Wait for your turn.");
}
export async function action(actor: string, id: string, body: unknown) {
  const input = envelope.parse(body);
  if (input.action !== "cancel") requireEnabled();
  return tx(async (db) => {
    const g = await load(db, actor, id);
    await reconcile(db, g);
    const replay = await one(
      db,
      "SELECT payload_hash FROM game_events WHERE game_id=$1 AND actor=$2 AND client_id=$3",
      [id, actor, input.clientId],
    );
    if (replay) {
      if (
        replay.payload_hash !==
        hash({ action: input.action, payload: input.payload })
      )
        throw new ConflictException(
          "Retry this action with its original answer.",
        );
      return projectGameV2(g, actor);
    }
    if (g.revision !== input.expectedRevision)
      throw new ConflictException("Your game changed. Refresh and try again.");
    const payload = applyGameAction(g, actor, input.action, input.payload);
    // Store the submitted canonical envelope hash for byte-order-independent
    // retries. The validated bounded payload is private, never a public event.
    if (JSON.stringify(payload).length > 4000)
      throw new BadRequestException("Game answer is too long.");
    await event(
      db,
      g,
      actor,
      input.action,
      input.clientId,
      payload,
      hash({ action: input.action, payload: input.payload }),
    );
    await save(db, g);
    if (input.action === "accept")
      await notification(
        db,
        g,
        g.host,
        actor,
        "accepted",
        "Your match accepted your game invitation.",
      );
    return projectGameV2(g, actor);
  });
}
