import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __resetRateLimit, clientIp, enforceCommentRateLimit, rateLimit } from "../src/rateLimit.mjs";

beforeEach(() => __resetRateLimit());

test("allows up to the limit then blocks within the window", () => {
  const opts = { limit: 3, windowMs: 60_000 };
  const now = 1_000_000;
  assert.equal(rateLimit("ip", opts, now).allowed, true);
  assert.equal(rateLimit("ip", opts, now).allowed, true);
  assert.equal(rateLimit("ip", opts, now).allowed, true);
  const blocked = rateLimit("ip", opts, now);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test("resets after the window passes", () => {
  const opts = { limit: 1, windowMs: 1_000 };
  assert.equal(rateLimit("ip", opts, 0).allowed, true);
  assert.equal(rateLimit("ip", opts, 500).allowed, false);
  assert.equal(rateLimit("ip", opts, 2_000).allowed, true);
});

test("keys are independent", () => {
  const opts = { limit: 1, windowMs: 60_000 };
  assert.equal(rateLimit("a", opts, 0).allowed, true);
  assert.equal(rateLimit("b", opts, 0).allowed, true);
});

test("enforceCommentRateLimit throws 429 once exceeded", () => {
  const req = { headers: { "x-forwarded-for": "9.9.9.9" } };
  const opts = { limit: 1, windowMs: 60_000 };
  enforceCommentRateLimit(req, opts);
  assert.throws(() => enforceCommentRateLimit(req, opts), (error) => error.statusCode === 429);
});

test("clientIp prefers the first x-forwarded-for entry", () => {
  assert.equal(clientIp({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }), "1.2.3.4");
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: "10.0.0.1" } }), "10.0.0.1");
});
