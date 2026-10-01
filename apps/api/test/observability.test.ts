import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { requestMetrics, metricsSnapshot } from "../src/observability";

test("metrics aggregate unknown paths and omit private request material", () => {
  const privateMarker = "synthetic-private-content";
  for (let index = 0; index < 100; index++) {
    const res = new EventEmitter() as any;
    res.statusCode = 200;
    res.setHeader = () => {};
    requestMetrics(
      {
        path: `/v1/unknown-${index}/${privateMarker}`,
        method: "GET",
        body: privateMarker,
        headers: { authorization: privateMarker },
      } as any,
      res,
      () => {},
    );
    res.emit("finish");
  }
  const res = new EventEmitter() as any;
  res.statusCode = 200;
  res.setHeader = () => {};
  requestMetrics(
    {
      path: `/v1/chat/${privateMarker}`,
      method: "GET",
      body: privateMarker,
    } as any,
    res,
    () => {},
  );
  res.emit("finish");
  const metrics = metricsSnapshot();
  assert.equal(metrics.requests["GET other"].count, 100);
  assert.equal(metrics.requests["GET /v1/chat"].count, 1);
  assert.equal(Object.keys(metrics.requests).length, 2);
  assert.ok(!JSON.stringify(metrics).includes(privateMarker));
});
