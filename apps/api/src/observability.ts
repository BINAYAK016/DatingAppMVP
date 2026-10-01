import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { Request, Response } from "express";
import { pool } from "./db";

const buckets = [25, 50, 100, 250, 500, 1000, 3000, 15000];
const totals = new Map<
  string,
  { count: number; errors: number; durationMs: number; histogram: number[] }
>();
// Only known resource names and HTTP verbs enter metrics. IDs, queries, headers,
// IPs, credentials, media paths and submitted content are never recorded here.
const resources = new Set([
  "auth",
  "verification",
  "onboarding",
  "state",
  "profile",
  "settings",
  "feed",
  "posts",
  "stories",
  "matches",
  "chat",
  "snaps",
  "game",
  "games",
  "game-catalog",
  "game-ready",
  "plan",
  "discovery",
  "discovery-undo",
  "reports",
  "notifications",
  "media",
  "saved",
  "blocks",
  "block",
  "unmatch",
  "export",
  "account",
  "logout",
  "device",
  "admin",
]);
export function requestMetrics(req: Request, res: Response, next: () => void) {
  const resource = req.path.split("/")[2] || "";
  const route =
    req.path.startsWith("/v1/") && resources.has(resource)
      ? `/v1/${resource}`
      : "other";
  const method = ["GET", "POST", "PATCH", "DELETE"].includes(req.method)
    ? req.method
    : "OTHER";
  const key = `${method} ${route}`;
  const requestId = randomUUID();
  res.setHeader("X-Request-ID", requestId);
  const start = performance.now();
  res.once("finish", () => {
    const duration = performance.now() - start;
    const total = totals.get(key) || {
      count: 0,
      errors: 0,
      durationMs: 0,
      histogram: Array(buckets.length + 1).fill(0),
    };
    total.count++;
    total.errors += res.statusCode >= 500 ? 1 : 0;
    total.durationMs += duration;
    const index = buckets.findIndex((bound) => duration <= bound);
    total.histogram[index < 0 ? buckets.length : index]++;
    totals.set(key, total);
    if (res.statusCode >= 500)
      console.error(
        JSON.stringify({
          event: "request_failed",
          requestId,
          method,
          route,
          status: res.statusCode,
        }),
      );
  });
  next();
}
export function metricsSnapshot() {
  return {
    instanceOnly: true,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssBytes: process.memoryUsage().rss,
      heapUsedBytes: process.memoryUsage().heapUsed,
    },
    databasePool: {
      connections: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    },
    durationBucketUpperBoundsMs: [...buckets, null],
    requests: Object.fromEntries(totals),
  };
}
