import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const local = process.argv.includes("--local");
const env = { ...process.env };
// Only explicit process environment config belongs in a distributable export.
env.EXPO_PUBLIC_CONNECTION_SETTINGS = "false";
env.EXPO_NO_DOTENV = "1";
env.EXPO_PUBLIC_API_URL = env.EXPO_PUBLIC_API_URL || "";
if (local) {
  // Build against the loopback preview's own API proxy. Never accidentally
  // inherit the previous DuckDNS address from a mobile dotenv file.
  env.EXPO_PUBLIC_API_URL = "";
}
if (!local && env.EXPO_PUBLIC_API_URL) {
  const api = new URL(env.EXPO_PUBLIC_API_URL);
  if (
    api.protocol !== "https:" ||
    api.username ||
    api.password ||
    api.pathname !== "/" ||
    api.search ||
    api.hash
  )
    throw new Error(
      "Remote web builds need an HTTPS API origin, or an empty value for the same origin.",
    );
}
const result = spawnSync(
  process.execPath,
  ["node_modules/expo/bin/cli", "export", "--platform", "web"],
  {
    cwd: fileURLToPath(new URL("../apps/mobile/", import.meta.url)),
    env,
    stdio: "inherit",
  },
);
process.exit(result.status ?? 1);
