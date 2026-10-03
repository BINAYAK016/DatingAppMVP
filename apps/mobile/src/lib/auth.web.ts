export const browserAuth = true;
export const apiCredentials = "include" as const;
export function apiHeaders(session: string | null): Record<string, string> {
  return {
    "X-Sangai-Client": "web",
    ...(session ? { "X-CSRF-Token": session } : {}),
  };
}
export function sessionFromSignIn(result: {
  token?: string;
  csrfToken?: string;
}) {
  if (!result.csrfToken)
    throw new Error("Browser sign-in could not finish. Please try again.");
  return result.csrfToken;
}
export async function resumeSession(server: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(server + "/v1/auth/session", {
      credentials: apiCredentials,
      headers: apiHeaders(null),
      signal: controller.signal,
    });
    if (response.status === 401) return null;
    if (!response.ok)
      throw new Error(
        "Could not restore your browser sign-in. Check your connection and try again.",
      );
    return sessionFromSignIn(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}
export function checkSession(response: Response, session: string | null) {
  const current = response.headers.get("X-Sangai-Session");
  if (session && current && current !== session) {
    const error = new Error("Your browser account changed. Reopening Sangai.");
    error.name = "BrowserSessionChangedError";
    throw error;
  }
}
