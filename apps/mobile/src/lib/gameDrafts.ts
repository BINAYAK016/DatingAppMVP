import { draftStorage } from "./storage";
import { clearGameConversations } from "./gameChatBridge";

const indexKey = "sangai.game-draft-index.v2";
let writes: Promise<unknown> = Promise.resolve();
const generations = new Map<string, number>();
let globalGeneration = 0;
export type GameDraftScope = {
  accountGeneration: number;
  globalGeneration: number;
};
export const gameDraftScope = (account: string): GameDraftScope => ({
  accountGeneration: generations.get(account) || 0,
  globalGeneration,
});
const currentScope = (account: string, scope: GameDraftScope) =>
  scope.globalGeneration === globalGeneration &&
  scope.accountGeneration === (generations.get(account) || 0);
const keyFor = (account: string, id: string) =>
  `sangai.game-draft.v2.${account}.${id}`;
async function get(key: string) {
  return draftStorage.getItemAsync(key);
}
async function put(key: string, value: string | null) {
  if (value === null) await draftStorage.deleteItemAsync(key);
  else await draftStorage.setItemAsync(key, value);
}
export async function readGameDraft<T>(
  account: string,
  id: string,
  scope = gameDraftScope(account),
): Promise<T | null> {
  if (!currentScope(account, scope)) return null;
  const key = keyFor(account, id),
    value = await get(key);
  if (!currentScope(account, scope)) return null;
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      parsed.version === 2 &&
      parsed.expires > Date.now() &&
      value.length <= 6000
    )
      return parsed.data as T;
  } catch {
    /* Invalid/obsolete local drafts are never sent to the server. */
  }
  await put(key, null);
  return null;
}
export function saveGameDraft(
  account: string,
  id: string,
  data: unknown,
  mountedScope = gameDraftScope(account),
) {
  if (!currentScope(account, mountedScope)) return Promise.resolve();
  if (!generations.has(account)) generations.set(account, 0);
  const generation = generations.get(account) || 0;
  const scope = globalGeneration;
  const task = writes
    .catch(() => {})
    .then(async () => {
      if (
        !currentScope(account, mountedScope) ||
        scope !== globalGeneration ||
        (generations.get(account) || 0) !== generation
      )
        return;
      const key = keyFor(account, id);
      if (data === null) {
        await put(key, null);
        return;
      }
      const value = JSON.stringify({
        version: 2,
        expires: Date.now() + 7 * 86400000,
        data,
      });
      if (value.length > 6000)
        throw new Error("This game draft is too long to save.");
      const stored = await get(indexKey);
      let keys: string[] = [];
      try {
        keys = stored ? JSON.parse(stored) : [];
      } catch {
        /* Start a bounded index. */
      }
      if (!Array.isArray(keys)) keys = [];
      keys = [...keys.filter((k) => typeof k === "string" && k !== key), key];
      for (const old of keys.slice(0, -20)) await put(old, null);
      await put(indexKey, JSON.stringify(keys.slice(-20)));
      await put(key, value);
    });
  writes = task;
  return task;
}
// Root auth calls this on logout/account loss. Generation checks prevent queued
// writes from resurrecting private drafts after that account has been cleared.
export async function clearGameDrafts(account?: string) {
  clearGameConversations(account);
  if (account) generations.set(account, (generations.get(account) || 0) + 1);
  else globalGeneration++;
  const task = writes
    .catch(() => {})
    .then(async () => {
      const value = await get(indexKey);
      let keys: string[] = [];
      try {
        keys = value ? JSON.parse(value) : [];
      } catch {
        /* Nothing readable to clear. */
      }
      if (!Array.isArray(keys)) keys = [];
      const prefix = account
        ? `sangai.game-draft.v2.${account}.`
        : "sangai.game-draft.v2.";
      for (const key of keys)
        if (typeof key === "string" && key.startsWith(prefix))
          await put(key, null);
      await put(
        indexKey,
        JSON.stringify(
          keys.filter(
            (key) => typeof key === "string" && !key.startsWith(prefix),
          ),
        ),
      );
    });
  writes = task;
  await task;
}
