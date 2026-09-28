import assert from "node:assert/strict";
import { test } from "node:test";
import { createStreamLifetime } from "./stream-lifetime";

const HOUR = 3_600_000;

test("no stream running is never expired", () => {
  const life = createStreamLifetime({ maxMs: 3 * HOUR, now: () => 0 });
  assert.equal(life.expired(), false);
});

test("a stream within its limit is live", () => {
  let t = 0;
  const life = createStreamLifetime({ maxMs: 3 * HOUR, now: () => t });
  life.started();
  t = 2 * HOUR;
  assert.equal(life.expired(), false);
});

test("a stream past its limit is expired (so heartbeats stop keeping the GPU up)", () => {
  let t = 0;
  const life = createStreamLifetime({ maxMs: 3 * HOUR, now: () => t });
  life.started();
  t = 3 * HOUR + 1;
  assert.equal(life.expired(), true);
});

test("a new stream restarts the clock", () => {
  let t = 0;
  const life = createStreamLifetime({ maxMs: 3 * HOUR, now: () => t });
  life.started();
  t = 4 * HOUR;
  life.started();
  t = 5 * HOUR;
  assert.equal(life.expired(), false);
});

test("stopping clears it", () => {
  let t = 0;
  const life = createStreamLifetime({ maxMs: 3 * HOUR, now: () => t });
  life.started();
  life.stopped();
  t = 10 * HOUR;
  assert.equal(life.expired(), false);
});
