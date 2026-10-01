import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { createServer, Socket } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { resolve } from "node:path";

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
async function call(path: string, token?: string, body?: unknown) {
  const response = await fetch(api + path, {
    method: body === undefined ? "GET" : "POST",
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
const codeIn = (message: string) => {
  const code = message.match(/\b\d{6}\b/)?.[0];
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
  await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
  await admin.end();
});

test("six-digit delivery, honest resend cooldown, replacement, atomic consumption and no code exposure", async () => {
  const user = await signup("otp-delivery");
  const initial = await call("/verification/send", user.token, {});
  assert.equal(initial.status, 201);
  assert.equal(initial.data.sent, true);
  const oldCode = codeIn(messages.at(-1)!);
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
  await db.query(
    "UPDATE auth_challenges SET expires_at=now()-interval '1 second' WHERE user_id=$1",
    [user.id],
  );
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
