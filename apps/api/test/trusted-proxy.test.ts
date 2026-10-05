import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { trustedProxyAddresses } from "../src/trusted-proxy";

async function visitorIp(configured: string, forwarded: string) {
  const app = express();
  app.set("trust proxy", trustedProxyAddresses(configured));
  app.get("/", (req, res) => res.json({ ip: req.ip }));
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { "X-Forwarded-For": forwarded },
    });
    assert.equal(response.status, 200);
    return ((await response.json()) as { ip: string }).ip;
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("blank proxy configuration keeps forwarded headers untrusted", () => {
  assert.equal(trustedProxyAddresses(""), false);
  assert.equal(trustedProxyAddresses(" , "), false);
});

test("proxy configuration accepts exact IPv4 and IPv6 addresses", () => {
  assert.deepEqual(trustedProxyAddresses(" 172.18.0.1, ::1, 172.18.0.1 "), [
    "172.18.0.1",
    "::1",
  ]);
});

test("blanket trust, ranges and named networks fail closed", () => {
  for (const value of ["true", "*", "loopback", "172.18.0.0/16", "0.0.0.0/0"])
    assert.throws(() => trustedProxyAddresses(value), /exact IPv4 or IPv6/);
});

test("a direct client cannot forge its IP through forwarded headers", async () => {
  assert.equal(await visitorIp("", "203.0.113.20"), "127.0.0.1");
});

test("a trusted proxy reveals the closest untrusted visitor, not a forged prefix", async () => {
  assert.equal(
    await visitorIp("127.0.0.1", "203.0.113.99, 198.51.100.20"),
    "198.51.100.20",
  );
});

test("a connection outside the trusted addresses cannot spoof a visitor", async () => {
  assert.equal(await visitorIp("172.18.0.1", "203.0.113.20"), "127.0.0.1");
});
