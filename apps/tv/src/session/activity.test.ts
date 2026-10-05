import { describe, expect, it } from "vitest";
import { ACTIVITY_TICK_MS, watchActivity } from "./activity";
import { createFakeClient } from "./fake-client";

const MIN = 60 * 1000;
const T0 = new Date(2026, 9, 4, 19, 0).getTime();

/**
 * The stream server ends a cast once `window.__ogsActivityAt` is more than 20 minutes old
 * (services/api/container/src/stream-lifetime.ts, read from the launcher page at each heartbeat).
 */
function setup(opts: { hold?: boolean } = {}) {
  let now = T0;
  const target: { __ogsActivityAt?: number } = {};
  const ticks: (() => void)[] = [];
  const client = createFakeClient({ now: () => now, hold: opts.hold });
  const stop = watchActivity(client, {
    target,
    now: () => now,
    every: (fn, ms) => {
      expect(ms).toBe(ACTIVITY_TICK_MS);
      ticks.push(fn);
      return () => ticks.splice(ticks.indexOf(fn), 1);
    },
  });
  const advance = (ms: number) => {
    // The interval fires every ACTIVITY_TICK_MS of the elapsed time.
    for (let t = 0; t < ms; t += ACTIVITY_TICK_MS) {
      now += Math.min(ACTIVITY_TICK_MS, ms - t);
      for (const fn of [...ticks]) fn();
    }
  };
  const everyoneLeaves = () => {
    for (const deviceId of ["jonathan-phone", "mom-phone", "juneau-ipad"])
      client.send({ type: "bye", deviceId });
  };
  return {
    client,
    target,
    ticks,
    stop,
    advance,
    everyoneLeaves,
    at: () => now,
    set: (t: number) => {
      now = t;
    },
  };
}

const idleFor = (s: { target: { __ogsActivityAt?: number }; at: () => number }) =>
  s.at() - (s.target.__ogsActivityAt ?? Number.NaN);

describe("the launcher tells the stream server when players were last around", () => {
  it("marks the cast's start as activity", () => {
    const s = setup();
    expect(s.target.__ogsActivityAt).toBe(T0);
  });

  it("stays active all evening while a phone or tablet is on the couch session", () => {
    const s = setup();
    s.advance(3 * 60 * MIN);
    expect(idleFor(s)).toBeLessThanOrEqual(ACTIVITY_TICK_MS);
  });

  it("goes quiet once every phone and tablet has left, so the 20-minute idle stop can end the stream", () => {
    const s = setup();
    s.advance(5 * MIN);
    s.everyoneLeaves();
    const left = s.at();
    s.advance(25 * MIN);
    expect(s.target.__ogsActivityAt).toBe(left);
    expect(idleFor(s)).toBeGreaterThan(20 * MIN);
  });

  it("a remote press (focus.move) is activity", async () => {
    const s = setup();
    s.everyoneLeaves();
    s.advance(10 * MIN);
    // The host's phone comes back and presses the D-pad.
    s.client.send({ type: "hello", deviceId: "jonathan-phone", kind: "phone" });
    s.everyoneLeaves();
    s.advance(10 * MIN);
    const before = s.at();
    s.client.send({ type: "focus.move", dir: "right" });
    await new Promise((r) => setTimeout(r, 0));
    expect(s.target.__ogsActivityAt).toBe(before);
  });

  it("any change to the session (a game starting, a phone joining) is activity", () => {
    const s = setup();
    s.everyoneLeaves();
    s.advance(15 * MIN);
    s.client.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    expect(s.target.__ogsActivityAt).toBe(s.at());
  });

  it("a rebroadcast of the same state is not activity", () => {
    const s = setup();
    s.everyoneLeaves();
    const left = s.target.__ogsActivityAt;
    s.advance(15 * MIN);
    s.client.drop();
    s.client.restore();
    expect(s.target.__ogsActivityAt).toBe(left);
  });

  it("before the session arrives, only the start counts (no controllers known yet)", () => {
    const s = setup({ hold: true });
    s.advance(21 * MIN);
    expect(s.target.__ogsActivityAt).toBe(T0);
    s.client.connect();
    expect(s.target.__ogsActivityAt).toBe(s.at());
  });

  it("stops watching when told", () => {
    const s = setup();
    s.stop();
    expect(s.ticks).toHaveLength(0);
    s.set(T0 + 30 * MIN);
    s.client.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    expect(s.target.__ogsActivityAt).toBe(T0);
  });
});
