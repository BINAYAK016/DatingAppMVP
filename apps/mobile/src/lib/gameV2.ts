// Public Games 2.0 API contract. No database rows or private event payloads.
export type GameQuestionV2 = {
  id: string;
  q: string;
  options: { id: string; label: string }[];
};
export type GameDefinitionV2 = {
  id: string;
  definitionVersion: number;
  title: string;
  subtitle: string;
  emoji: string;
  category: "Get to know you" | "Make them laugh" | "See if you click";
  durationMinutes: string;
  players: 2;
  mechanic: "choices" | "truths" | "guess" | "rapid" | "questions";
  questions: GameQuestionV2[];
  suggestions?: string[];
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
  question?: GameQuestionV2;
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
export type GameCatalogV2 = {
  enabled: boolean;
  games: GameDefinitionV2[];
  recommendedIds: string[];
  current:
    | GameSessionV2
    | { id: string; kind: string; version: number; state: string }
    | null;
};
export type GameActionV2 =
  | "accept"
  | "decline"
  | "cancel"
  | "choice"
  | "start-timer"
  | "finish"
  | "submit-truths"
  | "guess"
  | "set-answer"
  | "ask"
  | "respond";
export type GameActionRequestV2 = {
  clientId: string;
  expectedRevision: number;
  action: GameActionV2;
  payload: unknown;
};
