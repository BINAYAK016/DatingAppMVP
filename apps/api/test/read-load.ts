import { spawn, spawnSync, ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, mkdir, writeFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { cpus, tmpdir, totalmem } from "node:os";
import { createServer } from "node:net";
import { Pool } from "pg";
import { dropIsolatedDatabase } from "./database-cleanup";

// Run from apps/api after `npm run build`. This harness owns its database, API
// process and upload directory. Measured requests are read-only projections;
// game/chat reads are intentionally excluded because they can mutate state.
const options = new Map(
  process.argv.slice(2).map((arg) => {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match) throw new Error("Use --option=value arguments.");
    return [match[1], match[2]];
  }),
);
const known = new Set(["seconds", "concurrency", "requests", "rps", "output"]);
for (const key of options.keys())
  if (!known.has(key)) throw new Error("Unknown read-load option.");
function bounded(name: string, fallback: number, max: number) {
  const value = Number(options.get(name) || fallback);
  if (!Number.isInteger(value) || value < 1 || value > max)
    throw new Error(`Invalid ${name}; expected an integer from 1 to ${max}.`);
  return value;
}
const seconds = bounded("seconds", 10, 60);
const concurrency = bounded("concurrency", 4, 50);
const requestLimit = bounded("requests", 100, 500);
const offeredRps = bounded("rps", 10, 100);
const base =
  process.env.TEST_DATABASE_URL ||
  "postgres://sangai:local-beta-only@localhost:15432/sangai";
const databaseName = "sangai_read_load_" + randomUUID().replaceAll("-", "");
const databaseUrl = new URL(base);
databaseUrl.pathname = "/" + databaseName;
const admin = new Pool({ connectionString: base });
const fixtures = new Pool({ connectionString: databaseUrl.toString() });
const apiDirectory = resolve(".");
const workspaceDirectory = resolve(apiDirectory, "../../../..");
const outputRoot = resolve(workspaceDirectory, "outputs/load-qa");
const output = resolve(
  options.get("output") || join(outputRoot, `read-load-${Date.now()}.json`),
);
if (
  !output.startsWith(outputRoot + "/") &&
  !output.startsWith(outputRoot + "\\")
)
  throw new Error(
    "Output must stay inside the workspace outputs/load-qa directory.",
  );
const endpoints = [
  "/state",
  "/feed",
  "/matches?limit=10",
  "/stories?limit=10",
  "/notifications?limit=10",
];
type Sample = {
  latencyMs: number;
  status: number;
  bytes: number;
  error?: string;
};
const samples = new Map<string, Sample[]>(endpoints.map((path) => [path, []]));
const wait = (ms: number) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
let server: ChildProcess | undefined;
let uploads: string | undefined;
let created = false;

function assertOwnedDatabase() {
  if (
    !/^sangai_read_load_[a-f0-9]{32}$/.test(databaseName) ||
    new URL(base).pathname === databaseUrl.pathname
  )
    throw new Error("Disposable database boundary failed.");
}
async function freePort() {
  const listener = createServer();
  await new Promise<void>((ready, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", ready);
  });
  const address = listener.address();
  if (!address || typeof address === "string")
    throw new Error("Cannot allocate a local test port.");
  const port = address.port;
  await new Promise<void>((ready, reject) =>
    listener.close((error) => (error ? reject(error) : ready())),
  );
  return port;
}
function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(
    sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)].toFixed(3),
  );
}
async function run() {
  await stat(join(apiDirectory, "dist/main.js"));
  assertOwnedDatabase();
  await admin.query(`CREATE DATABASE ${databaseName}`);
  created = true;
  uploads = await mkdtemp(join(tmpdir(), "sangai-read-load-"));
  const port = await freePort();
  server = spawn(process.execPath, ["dist/main.js"], {
    cwd: apiDirectory,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      DATABASE_URL: databaseUrl.toString(),
      ENABLE_DEMO: "true",
      ENABLE_PUSH: "false",
      SMTP_HOST: "",
      UPLOAD_DIR: uploads,
      ADMIN_KEY: "isolated-read-load-admin",
    },
    stdio: "ignore",
  });
  let spawnFailed = false;
  server.once("error", () => {
    spawnFailed = true;
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 200; i++) {
    if (spawnFailed || server.exitCode !== null)
      throw new Error("Owned API exited during setup.");
    try {
      if (
        (
          await fetch(baseUrl + "/health", {
            signal: AbortSignal.timeout(1000),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await wait(100);
  }
  if (!ready)
    throw new Error(
      "Owned API did not become healthy. Rebuild before running.",
    );
  const users = (
    await fixtures.query(
      "SELECT id FROM users WHERE demo AND NOT suspended ORDER BY id LIMIT 1",
    )
  ).rows;
  if (!users.length)
    throw new Error("No isolated synthetic account was seeded.");
  const login = await fetch(baseUrl + "/v1/auth/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: users[0].id }),
    signal: AbortSignal.timeout(10000),
  });
  if (!login.ok) throw new Error("Synthetic account setup failed.");
  const token = (await login.json()).token;
  if (typeof token !== "string")
    throw new Error("Synthetic setup returned no session.");
  for (const endpoint of endpoints) {
    const response = await fetch(baseUrl + "/v1" + endpoint, {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error(
        "Warm-up failed; rebuild the API with the page routes before running.",
      );
    await response.arrayBuffer();
  }
  const manifest = (
    await fixtures.query(
      "SELECT 'users' AS entity,count(*)::int AS rows FROM users UNION ALL SELECT 'connections',count(*)::int FROM connections UNION ALL SELECT 'messages',count(*)::int FROM messages UNION ALL SELECT 'posts',count(*)::int FROM posts UNION ALL SELECT 'stories',count(*)::int FROM stories UNION ALL SELECT 'games',count(*)::int FROM games",
    )
  ).rows;
  const started = performance.now();
  const deadline = started + seconds * 1000;
  let scheduled = 0;
  async function worker() {
    while (scheduled < requestLimit) {
      const sequence = scheduled++;
      const scheduledAt = started + (sequence * 1000) / offeredRps;
      if (scheduledAt >= deadline || performance.now() >= deadline) return;
      if (scheduledAt > performance.now())
        await wait(scheduledAt - performance.now());
      if (performance.now() >= deadline) return;
      const endpoint = endpoints[sequence % endpoints.length];
      const requestStart = performance.now();
      try {
        const response = await fetch(baseUrl + "/v1" + endpoint, {
          headers: { Authorization: "Bearer " + token },
          signal: AbortSignal.timeout(
            Math.max(1, Math.floor(Math.min(10000, deadline - requestStart))),
          ),
        });
        const bytes = (await response.arrayBuffer()).byteLength;
        samples.get(endpoint)!.push({
          latencyMs: performance.now() - requestStart,
          status: response.status,
          bytes,
        });
      } catch (error: any) {
        samples.get(endpoint)!.push({
          latencyMs: performance.now() - requestStart,
          status: 0,
          bytes: 0,
          error:
            error.name === "TimeoutError"
              ? "timeout_or_window_end"
              : "transport_error",
        });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedSeconds = (performance.now() - started) / 1000;
  const results = Object.fromEntries(
    [...samples].map(([endpoint, values]) => {
      const times = values.map((v) => v.latencyMs);
      const statusCounts: Record<string, number> = {};
      for (const v of values)
        statusCounts[String(v.status)] =
          (statusCounts[String(v.status)] || 0) + 1;
      return [
        endpoint,
        {
          requests: values.length,
          errors: values.filter((v) => v.status < 200 || v.status >= 300)
            .length,
          statusCounts,
          p50Ms: percentile(times, 0.5),
          p95Ms: percentile(times, 0.95),
          p99Ms: percentile(times, 0.99),
          bytes: values.reduce((sum, v) => sum + v.bytes, 0),
        },
      ];
    }),
  );
  const total = [...samples.values()].flat();
  const git = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: apiDirectory,
    encoding: "utf8",
  });
  const dirty = spawnSync("git", ["status", "--porcelain"], {
    cwd: apiDirectory,
    encoding: "utf8",
  });
  const report = {
    recordedAt: new Date().toISOString(),
    sourceCommit: git.status === 0 ? git.stdout.trim() : "unknown",
    workingTreeDirty: dirty.status === 0 ? !!dirty.stdout.trim() : null,
    scope:
      "Owned disposable local API/database; synthetic demo fixtures; read-only measured endpoints",
    fixtureManifest: manifest,
    driver: {
      kind: "paced closed-loop workers",
      concurrency,
      maxDurationSeconds: seconds,
      maxRequests: requestLimit,
      offeredRequestsPerSecond: offeredRps,
      elapsedSeconds: Number(elapsedSeconds.toFixed(3)),
      actualRequests: total.length,
      actualRequestsPerSecond: Number(
        (total.length / elapsedSeconds).toFixed(3),
      ),
    },
    host: {
      platform: process.platform,
      logicalProcessors: cpus().length,
      totalMemoryBytes: totalmem(),
    },
    results,
    limitations: [
      "Tiny seed fixtures do not measure growth or production capacity.",
      "Closed-loop workers can underrepresent latency under saturation; this is a bounded smoke baseline.",
      "Host API and Docker PostgreSQL differ from a production deployment; resource contention is not controlled.",
      "Auth setup/warm-up/cleanup are excluded from measured latency; no Google, live verification, uploads, chat reads, games or external delivery were load-tested.",
      "No 1M/10M account or concurrent-user capacity claim is supported.",
    ],
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.info(
    JSON.stringify(
      {
        report: output,
        elapsedSeconds: report.driver.elapsedSeconds,
        requests: total.length,
        errors: total.filter((v) => v.status < 200 || v.status >= 300).length,
        results,
      },
      null,
      2,
    ),
  );
  if (total.some((v) => v.status < 200 || v.status >= 300))
    process.exitCode = 1;
}
async function cleanup() {
  if (server && server.exitCode === null) {
    const exited = new Promise<void>((ready) =>
      server!.once("exit", () => ready()),
    );
    server.kill();
    await Promise.race([exited, wait(2000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await fixtures.end();
  if (created) {
    assertOwnedDatabase();
    await dropIsolatedDatabase(admin, databaseName);
  }
  await admin.end();
  if (uploads) {
    if (
      dirname(resolve(uploads)) !== resolve(tmpdir()) ||
      !basename(uploads).startsWith("sangai-read-load-")
    )
      throw new Error("Temporary media boundary failed.");
    await rm(uploads, { recursive: true, force: true });
  }
}
run()
  .catch((error) => {
    // No bearer, connection string, response body or child logs are printed.
    console.error(
      "Bounded read-load run failed:",
      error instanceof Error ? error.name : "unknown",
    );
    process.exitCode = 1;
  })
  .finally(cleanup);
