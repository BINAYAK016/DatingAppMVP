import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { resolve } from "node:path";
import sharp from "sharp";
import { finishSignIn, browserCookieName } from "../src/browser-session";

const connection =
  process.env.TEST_DATABASE_URL ||
  "postgres://sangai:local-beta-only@localhost:15432/sangai";
const admin = new Pool({ connectionString: connection });
const database = "sangai_browser_" + randomUUID().replaceAll("-", "");
const isolated = new URL(connection);
isolated.pathname = "/" + database;
const db = new Pool({ connectionString: isolated.toString() });
const api = "http://127.0.0.1:4121/v1";
const origin = "http://localhost:8081";
let server: ChildProcess;
let logs = "";
let id: string;
let cookie = "";
let csrf = "";
async function request(
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
  method?: string,
) {
  const response = await fetch(api + path, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "X-Sangai-Client": "web",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, status: response.status, data: await response.json() };
}
before(async () => {
  await admin.query(`CREATE DATABASE ${database}`);
  server = spawn(process.execPath, ["dist/main.js"], {
    cwd: resolve("."),
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: isolated.toString(),
      PORT: "4121",
      ENABLE_DEMO: "true",
      DEMO_MODE: "true",
      WEB_COOKIE_SECURE: "false",
      ENABLE_PUSH: "false",
      UPLOAD_DIR: resolve("../../artifacts/browser-session-media"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => {
    logs += chunk;
  });
  server.stderr?.on("data", (chunk) => {
    logs += chunk;
  });
  for (let n = 0; n < 250; n++) {
    try {
      if ((await fetch(api.replace("/v1", "/health"))).ok) {
        const accounts = await request("/auth/demo");
        id = accounts.data[0].id;
        return;
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.fail("Browser test server startup failed: " + logs);
});
after(async () => {
  server?.kill();
  await new Promise((done) => setTimeout(done, 400));
  await db.end();
  await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
  await admin.end();
});
test("browser sign-in returns no bearer credential; HttpOnly session survives refresh", async () => {
  const login = await request("/auth/demo", { id });
  assert.equal(login.status, 201);
  assert.equal(login.data.token, undefined);
  assert.match(login.data.csrfToken, /^[a-f0-9]{64}$/);
  const header = login.response.headers.get("set-cookie")!;
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Path=\//);
  cookie = header.split(";")[0];
  csrf = login.data.csrfToken;
  const restored = await request("/auth/session");
  assert.equal(restored.status, 200);
  assert.equal(restored.data.csrfToken, csrf);
  const state = await request("/state");
  assert.equal(state.data.me.id, id);
  assert.equal(state.response.headers.get("x-sangai-session"), csrf);
  assert.equal(state.response.headers.get("cache-control"), "no-store");
});
test("cookie mutations require CSRF and approved origin, including multipart uploads", async () => {
  assert.equal(
    (
      await request(
        "/posts",
        { body: "Synthetic browser post" },
        { "X-CSRF-Token": "" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/posts",
        { body: "Synthetic browser post" },
        { Origin: "https://untrusted.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/posts",
        { body: "Synthetic browser post" },
        { Origin: "", Referer: "" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/auth/demo", { id }, { "X-Sangai-Client": "" })).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/auth/demo",
        { id },
        { Origin: "https://untrusted.example" },
      )
    ).status,
    403,
  );
  const posted = await request("/posts", {
    body: "Synthetic browser post",
    clientId: randomUUID(),
  });
  assert.equal(posted.status, 201);
  const form = new FormData();
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#AA536B" },
  })
    .png()
    .toBuffer();
  form.append(
    "file",
    new Blob([new Uint8Array(png)], { type: "image/png" }),
    "synthetic.png",
  );
  const denied = await fetch(api + "/media", {
    method: "POST",
    body: form,
    headers: { Cookie: cookie, Origin: origin },
  });
  assert.equal(denied.status, 403);
  const upload = await fetch(api + "/media", {
    method: "POST",
    body: form,
    headers: { Cookie: cookie, Origin: origin, "X-CSRF-Token": csrf },
  });
  assert.equal(upload.status, 201);
  const media = (await upload.json()) as { id: string };
  const read = await fetch(api + "/media/" + media.id, {
    headers: { Cookie: cookie },
  });
  assert.equal(read.status, 200);
  assert.match(read.headers.get("cache-control") || "", /no-store/);
  assert.equal((await fetch(api + "/media/" + media.id)).status, 401);
});
test("native bearer authentication remains independent; invalid bearer never falls back to cookies", async () => {
  const login = await fetch(api + "/auth/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const result = (await login.json()) as { token: string };
  assert.match(result.token, /^[a-f0-9]{64}$/);
  assert.equal(login.headers.get("set-cookie"), null);
  const native = await request("/state", undefined, {
    Authorization: "Bearer " + result.token,
  });
  assert.equal(native.status, 200);
  assert.equal(
    (await request("/state", undefined, { Authorization: "Bearer invalid" }))
      .status,
    401,
  );
  assert.equal(
    (await request("/logout", {}, { Authorization: "Bearer " + result.token }))
      .status,
    201,
  );
  assert.equal((await request("/state")).status, 200);
});
test("account changes reject stale CSRF; logout and expiry revoke the session", async () => {
  const stale = csrf;
  const login = await request("/auth/demo", { id });
  cookie = login.response.headers.get("set-cookie")!.split(";")[0];
  csrf = login.data.csrfToken;
  assert.notEqual(stale, csrf);
  assert.equal(
    (
      await request(
        "/posts",
        { body: "Must not publish under replacement session" },
        { "X-CSRF-Token": stale },
      )
    ).status,
    403,
  );
  const logout = await request("/logout", {});
  assert.equal(logout.status, 201);
  assert.match(
    logout.response.headers.get("set-cookie")!,
    /Expires=Thu, 01 Jan 1970/,
  );
  assert.equal((await request("/state")).status, 401);
  const fresh = await request("/auth/demo", { id });
  cookie = fresh.response.headers.get("set-cookie")!.split(";")[0];
  csrf = fresh.data.csrfToken;
  await db.query("UPDATE sessions SET expires_at=now()-interval '1 second'");
  const expired = await request("/auth/session");
  assert.equal(expired.status, 401);
  assert.match(
    expired.response.headers.get("set-cookie")!,
    /Expires=Thu, 01 Jan 1970/,
  );
});
test("remote cookie defaults are Secure, host-only and require exact configured origin", () => {
  const previousSecure = process.env.WEB_COOKIE_SECURE,
    previousOrigins = process.env.CORS_ORIGINS;
  process.env.WEB_COOKIE_SECURE = "true";
  process.env.CORS_ORIGINS = "https://sangai.example";
  let options: any;
  const req = {
    headers: { origin: "https://sangai.example", "x-sangai-client": "web" },
  } as any;
  const res = {
    cookie: (_name: string, _value: string, opts: any) => {
      options = opts;
    },
  } as any;
  try {
    assert.equal(browserCookieName(), "__Host-sangai-session");
    const result = finishSignIn({ token: "a".repeat(64) }, req, res);
    assert.equal("token" in result, false);
    assert.equal(options.secure, true);
    assert.equal(options.httpOnly, true);
    assert.equal(options.domain, undefined);
    assert.throws(() =>
      finishSignIn(
        { token: "a".repeat(64) },
        { headers: { ...req.headers, origin: "https://other.example" } } as any,
        res,
      ),
    );
  } finally {
    if (previousSecure === undefined) delete process.env.WEB_COOKIE_SECURE;
    else process.env.WEB_COOKIE_SECURE = previousSecure;
    if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previousOrigins;
  }
});
