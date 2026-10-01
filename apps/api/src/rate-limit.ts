import { HttpException } from "@nestjs/common";
import { createHash, createHmac } from "node:crypto";
import { pool } from "./db";

export type RequestScope = "api" | "auth" | "otp-send" | "otp-verify";
export type ActorAction =
  | "upload"
  | "profile"
  | "message"
  | "discovery"
  | "game-invite"
  | "post"
  | "comment"
  | "reaction"
  | "report";
const ipCaps: Record<RequestScope, number> = {
  api: configuredLimit("RATE_API_PER_MINUTE", 600),
  auth: configuredLimit("RATE_AUTH_PER_MINUTE", 40),
  "otp-send": configuredLimit("RATE_OTP_SEND_PER_MINUTE", 10),
  "otp-verify": configuredLimit("RATE_OTP_VERIFY_PER_MINUTE", 30),
};
const actorCaps: Record<ActorAction, [number, number]> = {
  upload: [configuredLimit("RATE_UPLOAD_PER_MINUTE", 10), 60],
  profile: [configuredLimit("RATE_PROFILE_PER_MINUTE", 30), 60],
  message: [configuredLimit("RATE_MESSAGE_PER_MINUTE", 120), 60],
  discovery: [configuredLimit("RATE_DISCOVERY_PER_MINUTE", 120), 60],
  "game-invite": [configuredLimit("RATE_GAME_INVITE_PER_MINUTE", 20), 60],
  post: [configuredLimit("RATE_POST_PER_MINUTE", 10), 60],
  comment: [configuredLimit("RATE_COMMENT_PER_MINUTE", 60), 60],
  reaction: [configuredLimit("RATE_REACTION_PER_MINUTE", 120), 60],
  report: [configuredLimit("RATE_REPORT_PER_HOUR", 5), 3600],
};
function configuredLimit(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 1000000)
    throw new Error(`Invalid positive limit configuration: ${name}`);
  return value;
}
const credentialRoutes = new Set([
  "/v1/auth/login",
  "/v1/auth/register",
  "/v1/auth/google",
  "/v1/auth/forgot",
  "/v1/auth/reset",
]);
export class RateLimitExceeded extends HttpException {
  constructor(
    public readonly retryAfterSeconds: number,
    message = "Please slow down and try again shortly.",
  ) {
    super(message, 429);
  }
}
export function requestScope(method: string, path: string): RequestScope {
  const route = path.toLowerCase().replace(/\/+$/, "");
  if (route.startsWith("/v1/verification/"))
    return route.endsWith("/send") ? "otp-send" : "otp-verify";
  return method === "POST" && credentialRoutes.has(route) ? "auth" : "api";
}
function keyHash(key: string) {
  // Pseudonymous short-lived counters, not an assertion that hashing anonymizes IPs.
  const secret = process.env.OTP_HASH_SECRET || process.env.ADMIN_KEY;
  return secret
    ? createHmac("sha256", secret).update(key).digest("hex")
    : createHash("sha256").update(key).digest("hex");
}
async function enforce(key: string, cap: number, seconds: number) {
  const result = await pool.query(
    `INSERT INTO rate_limit_counters(key_hash,hits,expires_at) VALUES($1,1,now()+$2*interval '1 second')
     ON CONFLICT(key_hash) DO UPDATE SET
       hits=CASE WHEN rate_limit_counters.expires_at<=now() THEN 1 ELSE LEAST(rate_limit_counters.hits+1,$3+1) END,
       expires_at=CASE WHEN rate_limit_counters.expires_at<=now() THEN now()+$2*interval '1 second' ELSE rate_limit_counters.expires_at END
     RETURNING hits,GREATEST(1,ceil(EXTRACT(EPOCH FROM expires_at-now())))::int AS retry_after`,
    [keyHash(key), seconds, cap],
  );
  if (result.rows[0].hits > cap)
    throw new RateLimitExceeded(result.rows[0].retry_after);
}
export async function enforceIpLimit(ip: string, scope: RequestScope) {
  await enforce(`ip:${scope}:${ip}`, ipCaps[scope], 60);
}
export async function enforceActorLimit(actor: string, action: ActorAction) {
  const [cap, seconds] = actorCaps[action];
  await enforce(`actor:${action}:${actor}`, cap, seconds);
}
export async function purgeRateLimits() {
  await pool.query("DELETE FROM rate_limit_counters WHERE expires_at<now()");
}
export function actionForRoute(
  method: string,
  path: string,
): ActorAction | undefined {
  const route = path.toLowerCase().replace(/\/+$/, "");
  if (method === "POST") {
    if (route === "/v1/media") return "upload";
    if (route === "/v1/reports") return "report";
    if (/^\/v1\/discovery(?:-undo)?\/[^/]+$/.test(route)) return "discovery";
    if (/^\/v1\/games\/[^/]+(?:\/invite)?$/.test(route)) return "game-invite";
    if (/^\/v1\/(?:chat|snaps)\/[^/]+$/.test(route)) return "message";
    if (/^\/v1\/posts\/[^/]+\/share$/.test(route)) return "message";
    if (route === "/v1/posts" || route === "/v1/stories") return "post";
    if (/^\/v1\/posts\/[^/]+\/comments$/.test(route)) return "comment";
    if (/^\/v1\/posts\/[^/]+\/react$/.test(route)) return "reaction";
  }
  if (
    ["POST", "PATCH", "DELETE"].includes(method) &&
    (route === "/v1/onboarding" ||
      route === "/v1/settings" ||
      route.startsWith("/v1/profile"))
  )
    return "profile";
}
