const starters = new Map<string, string>();
export function prepareGameConversation(
  account: string,
  target: string,
  prompt: string,
  server: string,
) {
  if (starters.size >= 20) starters.delete(starters.keys().next().value!);
  starters.set(`${account}:${server}:${target}`, prompt.slice(0, 500));
}
export function consumeGameConversation(
  account: string,
  target: string,
  server: string,
) {
  const key = `${account}:${server}:${target}`,
    value = starters.get(key);
  starters.delete(key);
  return value;
}
export function clearGameConversations(account?: string) {
  for (const key of starters.keys())
    if (!account || key.startsWith(`${account}:`)) starters.delete(key);
}
