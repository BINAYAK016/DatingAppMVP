type HistoryItem = { id: string; type?: string; created_at?: string };
type Conversation = { games: HistoryItem[]; timeline: HistoryItem[] };

// The history endpoint applies the same current-match and answer-secrecy checks
// as the latest conversation. A cursor includes the selected game's timestamp.
export async function findConversationGame(
  request: <T = any>(path: string) => Promise<T>,
  target: string,
  id: string,
  createdAt?: string,
) {
  if (!target || !id) return null;
  const chat = await request<Conversation>(`/chat/${target}`);
  const find = (value: Conversation) =>
    value.games.find((g) => g.id === id) ||
    value.timeline.find((g) => g.type === "game" && g.id === id);
  const current = find(chat);
  if (current) return current;
  const timestamp = createdAt ? new Date(createdAt).getTime() : NaN;
  if (!Number.isFinite(timestamp)) return null;
  // API cursors are exclusive. One millisecond includes the selected row even
  // when the database timestamp had sub-millisecond precision before encoding.
  const before = encodeURIComponent(new Date(timestamp + 1).toISOString());
  return (
    find(await request<Conversation>(`/chat/${target}?before=${before}`)) ||
    null
  );
}
