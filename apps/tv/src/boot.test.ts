import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, loadWithRetry } from "./boot";
import { FIXTURE_SESSION } from "./session/fixture";

describe("boot (fake mode)", () => {
  beforeEach(() => vi.stubGlobal("window", {}));
  afterEach(() => vi.unstubAllGlobals());

  it("serves the fixture launcher data, exposes the fake session, and keeps one boot id", async () => {
    const first = boot({ mode: "fake", hold: false }, "?fake=1&frameTimeout=500");
    expect(first.frameTimeoutMs).toBe(500);
    const data = await first.data;
    expect(data.session).toEqual(FIXTURE_SESSION);
    expect(data.games.length).toBeGreaterThan(0);
    const bootId = window.__launcherBootId;
    expect(bootId).toEqual(expect.any(String));

    const fake = window.__ogsFake;
    fake?.connect();
    fake?.send({ type: "focus.set", itemId: "game:x" });
    expect(fake?.state()).toBe(first.client.getSnapshot().state);
    fake?.drop();
    fake?.restore();

    boot({ mode: "fake", hold: true }, "");
    expect(window.__launcherBootId).toBe(bootId);
  });
});

describe("loadWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries with doubling backoff (capped at 10 s) until the data loads", async () => {
    const data = { games: [], instances: [], session: FIXTURE_SESSION };
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(data);
    const result = loadWithRetry(load);
    await vi.advanceTimersByTimeAsync(999);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toBe(data);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("never waits more than 10 s between tries", async () => {
    let calls = 0;
    const load = vi.fn(async () => {
      calls++;
      if (calls < 6) throw new Error("offline");
      return { games: [], instances: [], session: FIXTURE_SESSION };
    });
    const result = loadWithRetry(load);
    // 1 + 2 + 4 + 8 + 10 (not 16) seconds.
    await vi.advanceTimersByTimeAsync(25_000);
    await expect(result).resolves.toMatchObject({ session: FIXTURE_SESSION });
    expect(load).toHaveBeenCalledTimes(6);
  });
});
