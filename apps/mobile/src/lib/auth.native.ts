export const browserAuth = false;
export const apiCredentials = "omit" as const;
export function apiHeaders(session: string | null): Record<string, string> {
  return session ? { Authorization: "Bearer " + session } : {};
}
export function sessionFromSignIn(result: {
  token?: string;
  csrfToken?: string;
}) {
  if (!result.token)
    throw new Error("Sign-in could not finish. Please try again.");
  return result.token;
}
export async function resumeSession(_server: string): Promise<string | null> {
  return null;
}
export function checkSession(_response: Response, _session: string | null) {}
