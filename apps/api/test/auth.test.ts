import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { createServer, Socket } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { resolve } from "node:path";
import { dropIsolatedDatabase } from "./database-cleanup";

const base =
  process.env.TEST_DATABASE_URL ||
  "postgres://sangai:local-beta-only@localhost:15432/sangai";
const admin = new Pool({ connectionString: base });
const database = "sangai_auth_" + randomUUID().replaceAll("-", "");
const connection = new URL(base);
connection.pathname = "/" + database;
const db = new Pool({ connectionString: connection.toString() });
const port = Number(process.env.AUTH_TEST_PORT || 4105);
const api = `http://127.0.0.1:${port}/v1`;
let server: ChildProcess;
let logs = "";
let rejectNext = false;
let release: (() => void) | undefined;
let holdNext = false;
const messages: string[] = [];
const sockets = new Set<Socket>();
const smtp = createServer((socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.write("220 synthetic-test SMTP\r\n");
  let buffer = "",
    data = false,
    message = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    while (buffer.includes("\n")) {
      const end = buffer.indexOf("\n");
      const line = buffer.slice(0, end).replace(/\r$/, "");
      buffer = buffer.slice(end + 1);
      if (data) {
        if (line !== ".") {
          message += line + "\n";
          continue;
        }
        data = false;
        if (rejectNext) {
          rejectNext = false;
          socket.write("550 fixture delivery denied\r\n");
        } else {
          messages.push(message);
          if (holdNext) {
            holdNext = false;
            release = () => socket.write("250 accepted\r\n");
          } else socket.write("250 accepted\r\n");
        }
      } else if (/^EHLO|^HELO/i.test(line))
        socket.write("250 synthetic-test\r\n");
      else if (/^DATA/i.test(line)) {
        data = true;
        message = "";
        socket.write("354 send data\r\n");
      } else if (/^QUIT/i.test(line)) socket.end("221 bye\r\n");
      else socket.write("250 ok\r\n");
    }
  });
});
async function call(
  path: string,
  token?: string,
  body?: unknown,
  method?: string,
) {
  const response = await fetch(path.startsWith("http://") ? path : api + path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
async function signup(name: string) {
  const result = await call("/auth/register", undefined, {
    email: `${name}@example.test`,
    password: "synthetic-auth-password",
    acceptedPolicies: true,
  });
  assert.equal(result.status, 201);
  return { token: result.data.token, id: result.data.user.id };
}
const decodedMessage = (message: string) =>
  message
    .replace(/=\r?\n/g, "")
    .replace(/=([\da-f]{2})/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
const codeIn = (message: string) => {
  // Select the text-body code, not six coincidental digits in a MIME boundary.
  const code = decodedMessage(message).match(/code is:\s+(\d{6})\b/)?.[1];
  assert.ok(code);
  return code;
};
before(async () => {
  await admin.query(`CREATE DATABASE ${database}`);
  await new Promise<void>((done) => smtp.listen(0, "127.0.0.1", done));
  const address = smtp.address();
  assert.ok(address && typeof address !== "string");
  server = spawn(process.execPath, ["dist/main.js"], {
    cwd: resolve("."),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      DATABASE_URL: connection.toString(),
      ENABLE_DEMO: "false",
      ADMIN_KEY: "synthetic-auth-test-admin-key",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(address.port),
      SMTP_SECURE: "false",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
      OTP_HASH_SECRET: randomBytes(32).toString("hex"),
      GOOGLE_CLIENT_ID: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (data) => {
    logs += data;
  });
  server.stderr?.on("data", (data) => {
    logs += data;
  });
  server.on("error", (error) => {
    logs += error.message;
  });
  server.on("exit", (code) => {
    logs += ` Auth server exit ${code}.`;
  });
  for (let i = 0; i < 200; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;
    } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.fail("Isolated authentication server did not become healthy: " + logs);
});
after(async () => {
  release?.();
  server?.kill();
  await new Promise((done) => setTimeout(done, 400));
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((done) => smtp.close(() => done()));
  await db.end();
  await dropIsolatedDatabase(admin, database);
  await admin.end();
});

test("six-digit delivery, honest resend cooldown, replacement, atomic consumption and no code exposure", async () => {
  const user = await signup("otp-delivery");
  const initial = await call("/verification/send", user.token, {});
  assert.equal(initial.status, 201);
  assert.equal(initial.data.sent, true);
  const oldCode = codeIn(messages.at(-1)!);
  const delivered = decodedMessage(messages.at(-1)!);
  assert.match(delivered, /Content-Type: multipart\/alternative/i);
  assert.match(delivered, /Content-Type: text\/plain/i);
  assert.match(delivered, /Content-Type: text\/html/i);
  assert.match(delivered, /Subject: Your Sangai verification code/);
  assert.match(delivered, /Auto-Submitted: auto-generated/i);
  assert.match(delivered, /Verify your email/);
  assert.match(delivered, /Expires in 15 minutes/);
  assert.match(delivered, /Keep this code private/);
  assert.doesNotMatch(delivered, /<img\b|<script\b|<iframe\b|https?:\/\//i);
  assert.equal(JSON.stringify(initial.data).includes(oldCode), false);
  const stored = (
    await db.query("SELECT * FROM auth_challenges WHERE user_id=$1", [user.id])
  ).rows[0];
  assert.match(stored.token_hash, /^hmac:[a-f0-9]{64}$/);
  assert.notEqual(stored.token_hash, oldCode);
  const count = messages.length;
  const cooldown = await call("/verification/send", user.token, {});
  assert.equal(cooldown.data.sent, false);
  assert.equal(cooldown.data.resendAt, initial.data.resendAt);
  assert.equal(messages.length, count);
  await db.query(
    "UPDATE auth_challenges SET created_at=now()-interval '61 seconds' WHERE user_id=$1",
    [user.id],
  );
  const resend = await call("/verification/send", user.token, {});
  assert.equal(resend.data.sent, true);
  const newCode = codeIn(messages.at(-1)!);
  assert.notEqual(newCode, oldCode);
  assert.equal(
    (await call("/verification/confirm", user.token, { code: oldCode })).status,
    400,
  );
  const results = await Promise.all([
    call("/verification/confirm", user.token, { code: newCode }),
    call("/verification/confirm", user.token, { code: newCode }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  assert.equal(logs.includes(newCode), false);
  assert.equal(logs.includes(oldCode), false);
});

test("expired codes, five-attempt exhaustion and issuance caps are enforced", async () => {
  const user = await signup("otp-limits");
  await call("/verification/send", user.token, {});
  const code = codeIn(messages.at(-1)!);
  await db.query("UPDATE auth_challenges SET expires_at=$2 WHERE user_id=$1", [
    user.id,
    new Date(Date.now() - 60000),
  ]);
  const expired = await call("/verification/confirm", user.token, { code });
  assert.equal(expired.status, 400);
  assert.match(expired.data.message, /expired/);
  await db.query(
    "UPDATE auth_challenges SET expires_at=now()+interval '15 minutes' WHERE user_id=$1",
    [user.id],
  );
  const wrong = code === "000000" ? "000001" : "000000";
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await call("/verification/confirm", user.token, { code: wrong })).status,
      400,
    );
  const exhausted = await call("/verification/confirm", user.token, { code });
  assert.match(exhausted.data.message, /Too many incorrect/);
  assert.equal(
    (
      await db.query("SELECT attempts FROM auth_challenges WHERE user_id=$1", [
        user.id,
      ])
    ).rows[0].attempts,
    5,
  );
  await db.query(
    "UPDATE auth_challenges SET created_at=now()-interval '61 seconds' WHERE user_id=$1",
    [user.id],
  );
  for (let i = 0; i < 4; i++)
    await db.query(
      "INSERT INTO auth_challenges(id,user_id,purpose,token_hash,expires_at,created_at,used_at) VALUES($1,$2,'verify','synthetic-used-hash',now(),now()-interval '2 minutes',now())",
      [randomUUID(), user.id],
    );
  const limited = await call("/verification/send", user.token, {});
  assert.equal(limited.status, 400);
  assert.match(limited.data.message, /wait an hour/);
});

test("SMTP is outside the global lock; pending codes cannot redeem and failed delivery preserves an older code", async () => {
  const user = await signup("otp-smtp");
  holdNext = true;
  const sending = call("/verification/send", user.token, {});
  for (let i = 0; i < 100 && !release; i++)
    await new Promise((done) => setTimeout(done, 10));
  assert.ok(release);
  const code = codeIn(messages.at(-1)!);
  const lock = await db.connect();
  try {
    await lock.query("BEGIN");
    await lock.query("SET LOCAL statement_timeout='1000ms'");
    await lock.query("SELECT pg_advisory_xact_lock(20260929)");
    await lock.query("ROLLBACK");
  } finally {
    lock.release();
  }
  assert.equal(
    (await call("/verification/confirm", user.token, { code })).status,
    400,
  );
  release();
  release = undefined;
  assert.equal((await sending).status, 201);
  await db.query(
    "UPDATE auth_challenges SET created_at=now()-interval '61 seconds' WHERE user_id=$1",
    [user.id],
  );
  rejectNext = true;
  const failure = await call("/verification/send", user.token, {});
  assert.equal(failure.status, 503);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS count FROM auth_challenges WHERE user_id=$1",
        [user.id],
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (await call("/verification/confirm", user.token, { code })).status,
    201,
  );
});

test("password recovery uses one-time codes, hides address existence and invalidates sessions", async () => {
  const user = await signup("otp-reset");
  const known = await call("/auth/forgot", undefined, {
    email: "otp-reset@example.test",
  });
  const code = codeIn(messages.at(-1)!);
  const unknown = await call("/auth/forgot", undefined, {
    email: "no-such-fixture@example.test",
  });
  assert.equal(known.status, unknown.status);
  assert.match(messages.at(-1)!, /Subject: Your Sangai password reset code/);
  assert.match(messages.at(-1)!, /Content-Type: multipart\/alternative/i);
  assert.match(
    decodedMessage(messages.at(-1)!),
    /Your password will remain unchanged/,
  );
  assert.equal(known.data.message, unknown.data.message);
  assert.deepEqual(Object.keys(known.data), Object.keys(unknown.data));
  const updated = await call("/auth/reset", undefined, {
    email: "otp-reset@example.test",
    code,
    password: "changed-synthetic-password",
  });
  assert.equal(updated.status, 201);
  assert.equal((await call("/state", user.token)).status, 401);
  assert.equal(
    (
      await call("/auth/reset", undefined, {
        email: "otp-reset@example.test",
        code,
        password: "changed-synthetic-password",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/auth/login", undefined, {
        email: "otp-reset@example.test",
        password: "changed-synthetic-password",
      })
    ).status,
    201,
  );
  assert.equal((await call("/auth/config")).data.google, false);
  assert.equal(
    (
      await call("/auth/google", undefined, {
        idToken: "synthetic-invalid-token",
      })
    ).status,
    503,
  );
});

test("metadata and fictional demo traffic have separate quotas from credentials and OTP", async () => {
  const throttlePort = port + 1;
  const throttleApi = `http://127.0.0.1:${throttlePort}/v1`;
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: resolve("."),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(throttlePort),
      DATABASE_URL: connection.toString(),
      ENABLE_DEMO: "false",
      ADMIN_KEY: "synthetic-auth-test-admin-key",
      SMTP_HOST: "",
      OTP_HASH_SECRET: randomBytes(32).toString("hex"),
      GOOGLE_CLIENT_ID: "",
    },
    stdio: "ignore",
  });
  let spawnError: Error | undefined;
  child.once("error", (error) => {
    spawnError = error;
  });
  const exit = new Promise<void>((done) => child.once("close", () => done()));
  const status = async (route: string, body?: unknown) => {
    const response = await fetch(
      route.startsWith("http://") ? route : throttleApi + route,
      {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    await response.arrayBuffer();
    return response.status;
  };
  try {
    let healthy = false;
    for (let i = 0; i < 200 && !healthy; i++) {
      if (spawnError) throw spawnError;
      try {
        healthy = (await fetch(`http://127.0.0.1:${throttlePort}/health`)).ok;
      } catch {}
      if (!healthy) await new Promise((done) => setTimeout(done, 100));
    }
    assert.ok(healthy, "Isolated throttle server did not become healthy");
    const fictionalDemo = { id: randomUUID() };
    for (let i = 0; i < 41; i++) {
      assert.equal(await status("/auth/config"), 200);
      assert.equal(await status("/auth/demo"), 200);
      assert.equal(await status("/auth/demo", fictionalDemo), 403);
    }
    const credentials = {
      email: "no-such-throttle-fixture@example.test",
      password: "synthetic-throttle-password",
    };
    for (let i = 0; i < 40; i++)
      assert.equal(await status("/auth/login", credentials), 401);
    for (const route of [
      "login",
      "register",
      "google",
      "forgot",
      "reset",
      "LOGIN/",
    ])
      assert.equal(await status("/auth/" + route, {}), 429);
    assert.equal(
      await status(throttleApi.slice(0, -3) + "/V1/auth/login", credentials),
      429,
    );
    assert.equal(
      await status(throttleApi.slice(0, -3) + "/V1/AUTH/RESET/", {}),
      429,
    );
    assert.equal(await status("/auth/config"), 200);
    assert.equal(await status("/auth/demo", fictionalDemo), 403);
    for (let i = 0; i < 10; i++)
      assert.equal(await status("/verification/send", {}), 401);
    assert.equal(await status("/verification/send", {}), 429);
    assert.equal(await status("/verification/SEND/", {}), 429);
    assert.equal(
      await status(throttleApi.slice(0, -3) + "/V1/verification/send/", {}),
      429,
    );
    for (let i = 0; i < 30; i++)
      assert.equal(
        await status("/verification/confirm", { code: "000000" }),
        401,
      );
    assert.equal(
      await status("/verification/confirm", { code: "000000" }),
      429,
    );
    assert.equal(
      await status(throttleApi.slice(0, -3) + "/V1/VERIFICATION/CONFIRM/", {
        code: "000000",
      }),
      429,
    );
    assert.equal(await status("/auth/config"), 200);
  } finally {
    child.kill();
    await exit;
  }
});

test("case and trailing-slash variants preserve admin, session and setup guards", async () => {
  const origin = api.slice(0, -3);
  for (const path of [
    "/V1/admin/reports",
    "/v1/ADMIN/reports/",
    "/V1/ADMIN/REPORTS/",
  ])
    assert.equal((await call(origin + path)).status, 401);
  const authorized = await fetch(origin + "/V1/ADMIN/REPORTS/", {
    headers: { "x-admin-key": "synthetic-auth-test-admin-key" },
  });
  assert.equal(authorized.status, 200);
  await authorized.body?.cancel();
  assert.equal((await call(origin + "/V1/state/")).status, 401);
  const user = await signup("case-guards");
  assert.equal((await call(origin + "/V1/STATE/", user.token)).status, 200);
  assert.equal(
    (
      await call(
        origin + "/V1/ONBOARDING/",
        user.token,
        {
          step: 0,
          data: {
            name: "Case Fixture",
            birthDate: "1997-03-10",
            city: "Kathmandu",
            gender: "Woman",
            adult: true,
          },
        },
        "PATCH",
      )
    ).status,
    403,
  );
  const upload = await call(origin + "/V1/MEDIA/", user.token, {});
  assert.equal(upload.status, 400);
  assert.equal(
    upload.data.message,
    "Verify your email and complete the adult declaration before adding photos.",
  );
  const sent = await call(origin + "/V1/VERIFICATION/SEND/", user.token, {});
  assert.equal(sent.status, 201);
  assert.equal(sent.data.sent, true);
});
