import { ForbiddenException } from "@nestjs/common";
import type { Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { authenticate, digest } from "./auth";

// An explicit loopback-only exception enables local HTTP testing. Remote beta
// sessions always use the host-only Secure cookie; never set a Domain attribute.
const localCookie = () =>
  process.env.WEB_COOKIE_SECURE === "false" &&
  ["development", "test"].includes(process.env.NODE_ENV || "");
export const browserCookieName = () =>
  localCookie() ? "sangai-local-session" : "__Host-sangai-session";
export const csrfFor = (token: string) =>
  digest("sangai-browser-csrf:" + token);
export function browserToken(req: Request): string | undefined {
  const name = browserCookieName();
  const values = (req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim().split("="))
    .filter(([key]) => key === name);
  if (values.length !== 1 || !/^[a-f0-9]{64}$/.test(values[0][1] || ""))
    return undefined;
  return values[0][1];
}
function requestOrigin(req: Request) {
  if (req.headers.origin) return req.headers.origin;
  try {
    return new URL(req.headers.referer || "").origin;
  } catch {
    return "";
  }
}
export function requireBrowserOrigin(req: Request) {
  const origin = requestOrigin(req);
  const approved = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((v) => v.trim());
  const loopback = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!origin || (localCookie() ? !loopback : !approved.includes(origin)))
    throw new ForbiddenException("This browser origin is not approved.");
}
export function requireCsrf(req: Request, token: string) {
  requireBrowserOrigin(req);
  const actual = String(req.headers["x-csrf-token"] || "");
  const expected = csrfFor(token);
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    throw new ForbiddenException(
      "Your browser session changed. Refresh and try again.",
    );
}
export function clearBrowserCookie(res: Response) {
  res.clearCookie(browserCookieName(), {
    httpOnly: true,
    secure: !localCookie(),
    sameSite: "lax",
    path: "/",
  });
}
export async function browserSession(req: Request, res: Response) {
  requireBrowserOrigin(req);
  const token = browserToken(req);
  try {
    await authenticate(token ? "Bearer " + token : undefined);
    return { csrfToken: csrfFor(token!) };
  } catch (error) {
    clearBrowserCookie(res);
    throw error;
  }
}
export function finishSignIn<T extends { token: string }>(
  result: T,
  req: Request,
  res: Response,
) {
  if (req.headers["x-sangai-client"] !== "web") return result;
  // Also validated before issuing any session in the auth middleware.
  requireBrowserOrigin(req);
  res.cookie(browserCookieName(), result.token, {
    httpOnly: true,
    secure: !localCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400000,
  });
  const { token, ...rest } = result;
  return { ...rest, csrfToken: csrfFor(token) };
}
