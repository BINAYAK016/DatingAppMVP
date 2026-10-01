export type SessionCredentialStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

const sessionKey = "sangai-session-v2";
const legacyTokenKey = "sangai-session";
const legacyServerKey = "sangai-session-server";
const invalidRecord = () =>
  new Error("Saved sign-in is invalid. Please sign in again.");
const clearFailure = () =>
  new Error("Saved sign-in could not be completely cleared. Please try again.");
function validOrigin(value: unknown): value is string {
  if (typeof value !== "string" || !value || value !== value.trim())
    return false;
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
function validToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !/\s/.test(value);
}

// One storage item binds the bearer token to its server. A failed save cannot
// independently replace origin metadata while retaining another server's token.
export async function writeSessionCredentials(
  storage: SessionCredentialStorage,
  server: string,
  token: string,
): Promise<void> {
  if (!validOrigin(server) || !validToken(token)) throw invalidRecord();
  await storage.setItemAsync(sessionKey, JSON.stringify({ server, token }));
}

export async function readSessionCredentials(
  storage: SessionCredentialStorage,
  server: string,
  defaultServer: string,
): Promise<string | null> {
  if (!validOrigin(server) || !validOrigin(defaultServer))
    throw invalidRecord();
  const stored = await storage.getItemAsync(sessionKey);
  if (stored !== null) {
    let record: unknown;
    try {
      record = JSON.parse(stored);
    } catch {
      throw invalidRecord();
    }
    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record) ||
      !validOrigin((record as { server?: unknown }).server) ||
      !validToken((record as { token?: unknown }).token)
    )
      throw invalidRecord();
    const credential = record as { server: string; token: string };
    return credential.server === server ? credential.token : null;
  }
  const token = await storage.getItemAsync(legacyTokenKey);
  if (token === null) return null;
  if (!validToken(token)) throw invalidRecord();
  const boundServer = await storage.getItemAsync(legacyServerKey);
  if (boundServer !== null && !validOrigin(boundServer)) throw invalidRecord();
  if (
    boundServer !== server &&
    !(boundServer === null && server === defaultServer)
  )
    return null;
  // Return legacy credentials only after their server/token migrate together.
  // Failed optional cleanup is safe because the atomic record takes precedence.
  await writeSessionCredentials(storage, server, token);
  try {
    await storage.deleteItemAsync(legacyTokenKey);
    await storage.deleteItemAsync(legacyServerKey);
  } catch {
    // Do not remove the legacy binding if deleting its token failed.
  }
  return token;
}

// Preserve the legacy binding AND v2 record if legacy-token removal fails.
// Otherwise a surviving bound token could become an unbound default-server
// credential. Once that token is gone, attempt both remaining deletions.
// Storage failure cannot guarantee persistent logout: callers must clear local
// state, retain a visible warning, and allow retry before closing the app.
export async function clearSessionCredentials(
  storage: SessionCredentialStorage,
): Promise<void> {
  try {
    await storage.deleteItemAsync(legacyTokenKey);
  } catch {
    throw clearFailure();
  }
  let failed = false;
  for (const key of [legacyServerKey, sessionKey]) {
    try {
      await storage.deleteItemAsync(key);
    } catch {
      failed = true;
    }
  }
  if (failed) throw clearFailure();
}
