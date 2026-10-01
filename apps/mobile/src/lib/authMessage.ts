export function authMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Could not complete that action.";
  if (
    /fetch failed|failed to fetch|Network request failed|Cannot reach|Docker|AbortError|ConnectException/i.test(
      message,
    )
  )
    return "We couldn’t connect. Check your connection and try again.";
  if (
    /Invalid input|Invalid email|expected .*received|String must|Too small|Too big/i.test(
      message,
    )
  )
    return "Check your details and try again.";
  return message;
}
