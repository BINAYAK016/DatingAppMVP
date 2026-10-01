import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearSessionCredentials,
  readSessionCredentials,
  writeSessionCredentials,
  type SessionCredentialStorage,
} from "../apps/mobile/src/lib/sessionCredentials";

const oldOrigin = "https://old.synthetic.example";
const newOrigin = "https://new.synthetic.example";
const defaultOrigin = "http://10.0.2.2:4100";
const atomicKey = "sangai-session-v2";
const legacyTokenKey = "sangai-session";
const legacyBindingKey = "sangai-session-server";
function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const calls: { operation: string; key: string }[] = [];
  const failDelete = new Set<string>();
  let failWrite = false;
  const adapter: SessionCredentialStorage = {
    async getItemAsync(key) {
      calls.push({ operation: "get", key });
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      calls.push({ operation: "set", key });
      if (failWrite) throw new Error("Synthetic storage write failure");
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      calls.push({ operation: "delete", key });
      if (failDelete.has(key))
        throw new Error("Synthetic storage deletion failure");
      values.delete(key);
    },
  };
  return {
    adapter,
    values,
    calls,
    failDelete,
    setFailWrite: (value: boolean) => {
      failWrite = value;
    },
  };
}

test("one atomic item binds a saved token and takes precedence over legacy data", async () => {
  const fake = storage({
    [legacyTokenKey]: "synthetic-legacy-token",
    [legacyBindingKey]: newOrigin,
  });
  await writeSessionCredentials(fake.adapter, oldOrigin, "synthetic-old-token");
  assert.deepEqual(JSON.parse(fake.values.get(atomicKey)!), {
    server: oldOrigin,
    token: "synthetic-old-token",
  });
  assert.deepEqual(
    fake.calls.filter((call) => call.operation === "set"),
    [{ operation: "set", key: atomicKey }],
  );
  assert.equal(
    await readSessionCredentials(fake.adapter, oldOrigin, defaultOrigin),
    "synthetic-old-token",
  );
  assert.equal(
    await readSessionCredentials(fake.adapter, newOrigin, defaultOrigin),
    null,
  );
});

test("failed legacy deletion and failed new-origin save cannot forward an old token", async () => {
  const fake = storage({
    [legacyTokenKey]: "synthetic-old-token",
    [legacyBindingKey]: oldOrigin,
    [atomicKey]: JSON.stringify({
      server: oldOrigin,
      token: "synthetic-old-token",
    }),
  });
  fake.failDelete.add(legacyTokenKey);
  await assert.rejects(
    clearSessionCredentials(fake.adapter),
    /completely cleared/,
  );
  assert.deepEqual(
    fake.calls
      .filter((call) => call.operation === "delete")
      .map((call) => call.key),
    [legacyTokenKey],
  );
  assert.equal(fake.values.get(legacyBindingKey), oldOrigin);
  fake.setFailWrite(true);
  await assert.rejects(
    writeSessionCredentials(fake.adapter, newOrigin, "synthetic-new-token"),
    /Synthetic storage write failure/,
  );
  assert.equal(
    await readSessionCredentials(fake.adapter, newOrigin, defaultOrigin),
    null,
  );
  assert.equal(
    await readSessionCredentials(fake.adapter, defaultOrigin, defaultOrigin),
    null,
  );
  assert.equal(
    await readSessionCredentials(fake.adapter, oldOrigin, defaultOrigin),
    "synthetic-old-token",
  );
});

test("a matching legacy binding migrates before optional cleanup and cleanup failure stays bound", async () => {
  const fake = storage({
    [legacyTokenKey]: "synthetic-legacy-token",
    [legacyBindingKey]: oldOrigin,
  });
  fake.failDelete.add(legacyTokenKey);
  assert.equal(
    await readSessionCredentials(fake.adapter, oldOrigin, defaultOrigin),
    "synthetic-legacy-token",
  );
  assert.deepEqual(JSON.parse(fake.values.get(atomicKey)!), {
    server: oldOrigin,
    token: "synthetic-legacy-token",
  });
  assert.equal(fake.values.get(legacyBindingKey), oldOrigin);
  const operations = fake.calls.filter((call) =>
    ["set", "delete"].includes(call.operation),
  );
  assert.deepEqual(
    operations.map((call) => [call.operation, call.key]),
    [
      ["set", atomicKey],
      ["delete", legacyTokenKey],
    ],
  );
  assert.equal(
    await readSessionCredentials(fake.adapter, newOrigin, defaultOrigin),
    null,
  );
});

test("unbound legacy credentials migrate only at the original default server", async () => {
  const fake = storage({ [legacyTokenKey]: "synthetic-unbound-token" });
  assert.equal(
    await readSessionCredentials(fake.adapter, newOrigin, defaultOrigin),
    null,
  );
  assert.equal(fake.values.has(atomicKey), false);
  assert.equal(
    await readSessionCredentials(fake.adapter, defaultOrigin, defaultOrigin),
    "synthetic-unbound-token",
  );
  assert.deepEqual(JSON.parse(fake.values.get(atomicKey)!), {
    server: defaultOrigin,
    token: "synthetic-unbound-token",
  });
  assert.equal(fake.values.has(legacyTokenKey), false);
});

test("a cross-origin legacy binding never becomes an unbound default token after failed clear", async () => {
  const fake = storage({
    [legacyTokenKey]: "synthetic-bound-token",
    [legacyBindingKey]: oldOrigin,
  });
  fake.failDelete.add(legacyTokenKey);
  await assert.rejects(
    clearSessionCredentials(fake.adapter),
    /completely cleared/,
  );
  assert.equal(fake.values.get(legacyBindingKey), oldOrigin);
  assert.equal(
    await readSessionCredentials(fake.adapter, defaultOrigin, defaultOrigin),
    null,
  );
  assert.equal(
    await readSessionCredentials(fake.adapter, newOrigin, defaultOrigin),
    null,
  );
});

test("failed migration does not return or rebind legacy credentials", async () => {
  const fake = storage({
    [legacyTokenKey]: "synthetic-legacy-token",
    [legacyBindingKey]: oldOrigin,
  });
  fake.setFailWrite(true);
  await assert.rejects(
    readSessionCredentials(fake.adapter, oldOrigin, defaultOrigin),
    /Synthetic storage write failure/,
  );
  assert.equal(fake.values.has(atomicKey), false);
  assert.equal(fake.values.get(legacyBindingKey), oldOrigin);
  assert.equal(
    fake.calls.some((call) => call.operation === "delete"),
    false,
  );
  assert.equal(
    await readSessionCredentials(fake.adapter, newOrigin, defaultOrigin),
    null,
  );
});

test("malformed atomic credentials fail closed without falling back to a legacy token", async () => {
  for (const record of [
    "",
    "not-json",
    "null",
    "[]",
    JSON.stringify({ server: oldOrigin, token: 42 }),
    JSON.stringify({ server: oldOrigin, token: "" }),
    JSON.stringify({ server: oldOrigin, token: "two tokens" }),
    JSON.stringify({ server: "javascript:alert(1)", token: "synthetic" }),
    JSON.stringify({ server: oldOrigin + "/private", token: "synthetic" }),
    JSON.stringify({
      server: "https://user:pass@old.synthetic.example",
      token: "synthetic",
    }),
  ]) {
    const fake = storage({
      [atomicKey]: record,
      [legacyTokenKey]: "synthetic-legacy-token",
      [legacyBindingKey]: oldOrigin,
    });
    await assert.rejects(
      readSessionCredentials(fake.adapter, oldOrigin, defaultOrigin),
      /Saved sign-in is invalid/,
    );
    assert.deepEqual(fake.calls, [{ operation: "get", key: atomicKey }]);
  }
});

test("clear attempts both remaining deletions after removing the legacy token", async () => {
  const fake = storage({
    [legacyTokenKey]: "synthetic-legacy-token",
    [legacyBindingKey]: oldOrigin,
    [atomicKey]: JSON.stringify({
      server: oldOrigin,
      token: "synthetic-old-token",
    }),
  });
  fake.failDelete.add(legacyBindingKey);
  await assert.rejects(
    clearSessionCredentials(fake.adapter),
    /completely cleared/,
  );
  assert.deepEqual(
    fake.calls.map((call) => call.key),
    [legacyTokenKey, legacyBindingKey, atomicKey],
  );
  assert.equal(fake.values.has(legacyTokenKey), false);
  assert.equal(fake.values.has(atomicKey), false);
  assert.equal(
    await readSessionCredentials(fake.adapter, oldOrigin, defaultOrigin),
    null,
  );
});

test("failed v2 deletion retains its original server binding and succeeds on retry", async () => {
  const fake = storage({
    [legacyTokenKey]: "synthetic-legacy-token",
    [legacyBindingKey]: oldOrigin,
    [atomicKey]: JSON.stringify({
      server: oldOrigin,
      token: "synthetic-old-token",
    }),
  });
  fake.failDelete.add(atomicKey);
  await assert.rejects(
    clearSessionCredentials(fake.adapter),
    /completely cleared/,
  );
  assert.equal(fake.values.has(legacyTokenKey), false);
  assert.equal(fake.values.has(legacyBindingKey), false);
  assert.equal(
    await readSessionCredentials(fake.adapter, newOrigin, defaultOrigin),
    null,
  );
  assert.equal(
    await readSessionCredentials(fake.adapter, oldOrigin, defaultOrigin),
    "synthetic-old-token",
  );
  fake.failDelete.clear();
  await clearSessionCredentials(fake.adapter);
  assert.equal(
    await readSessionCredentials(fake.adapter, oldOrigin, defaultOrigin),
    null,
  );
});

test("invalid inputs do not persist anything and an empty storage reads as signed out", async () => {
  const fake = storage();
  for (const [server, token] of [
    ["not-an-origin", "synthetic"],
    [oldOrigin + "?query=1", "synthetic"],
    [oldOrigin + "#fragment", "synthetic"],
    [oldOrigin, ""],
  ])
    await assert.rejects(
      writeSessionCredentials(fake.adapter, server, token),
      /invalid/,
    );
  assert.equal(fake.values.size, 0);
  assert.equal(
    await readSessionCredentials(fake.adapter, oldOrigin, defaultOrigin),
    null,
  );
  await clearSessionCredentials(fake.adapter);
  assert.equal(fake.values.size, 0);
});
