// Run against the local demo-enabled Docker API, with a synthetic short MP4.
// Example: node tests/media-smoke.mjs artifacts/video-test.mp4
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const api = process.env.TEST_API_URL || "http://localhost:4100/v1";
const tokens = await Promise.all(
  [1, 2, 5].map(async (n) => {
    const r = await fetch(api + "/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "10000000-0000-4000-8000-" + String(n).padStart(12, "0"),
      }),
    });
    assert.equal(r.status, 201);
    return (await r.json()).token;
  }),
);
async function call(path, who, body, method = "POST") {
  const r = await fetch(api + path, {
    method,
    headers: {
      Authorization: "Bearer " + tokens[who],
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  assert.ok(r.ok, `${path}: ${r.status}`);
  return r.json();
}
const form = new FormData();
form.append(
  "file",
  new Blob([await readFile(process.argv[2])], { type: "video/mp4" }),
  "synthetic.mp4",
);
const uploaded = await fetch(api + "/media", {
  method: "POST",
  headers: { Authorization: "Bearer " + tokens[0] },
  body: form,
});
assert.equal(uploaded.status, 201);
const media = await uploaded.json();
assert.equal(media.kind, "video");
const post = await call("/posts", 0, {
  body: "Synthetic video smoke test",
  mediaId: media.id,
});
try {
  const match = await fetch(api + "/media/" + media.id, {
    headers: { Authorization: "Bearer " + tokens[1], Range: "bytes=0-99" },
  });
  assert.equal(match.status, 206);
  assert.equal((await match.arrayBuffer()).byteLength, 100);
  assert.equal(match.headers.get("content-type"), "video/mp4");
  const outsider = await fetch(api + "/media/" + media.id, {
    headers: { Authorization: "Bearer " + tokens[2] },
  });
  assert.equal(outsider.status, 404);
} finally {
  await call("/posts/" + post.id, 0, undefined, "DELETE");
}
const snap = await call("/snaps/10000000-0000-4000-8000-000000000002", 0, {
  mediaId: media.id,
  caption: "Synthetic video snap",
});
const opened = await call("/snaps/" + snap.id + "/open", 1, {});
assert.equal(opened.kind, "video");
await call("/snaps/" + snap.id + "/close", 1, {});
const closed = await fetch(api + "/media/" + media.id, {
  headers: { Authorization: "Bearer " + tokens[1] },
});
assert.equal(closed.status, 404);
console.log(
  "PASS: Docker FFmpeg video upload/transcode, authenticated range playback, outsider denial and video snap closure.",
);
