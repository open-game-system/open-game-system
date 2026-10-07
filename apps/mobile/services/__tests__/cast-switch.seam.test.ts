jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

import { castToTv, switchTv } from "../cast-flow";
import { createCastStore } from "../cast-store";
import { announceSwitch, createCastSwitch } from "../cast-switch";
import { castCommands, startCastSync } from "../cast-sync";
import { readConfig } from "../config";
import { createFakeCastBackend, FAKE_TV, FAKE_TV_2 } from "../fake-cast";

/**
 * Seam: the real cast flow + cast sync against two fake Chromecasts with Google Cast's real
 * timing (endCurrentSession resolves at once, the session ends a moment later, and a start while
 * it ends is refused). Owner, 2026-10-05, real iPhone and two Chromecasts: "when i tap the other
 * device sometimes it works and sometimes it doesn't".
 */

type Tv = { viewUrl: string | null; loads: number; stops: number };

function room(endedAfterMs: number) {
  const tvs: Record<string, Tv> = {
    "tv1.test": { viewUrl: null, loads: 0, stops: 0 },
    "tv2.test": { viewUrl: null, loads: 0, stops: 0 },
  };
  const backend = createFakeCastBackend({
    mode: "two",
    loadUrl: "http://tv1.test/load",
    loadUrls: { [FAKE_TV_2.id]: "http://tv2.test/load" },
    endedAfterMs,
    fetch: async (url, init) => {
      const u = new URL(url);
      const tv = tvs[u.host];
      if (u.pathname === "/load") {
        tv.viewUrl = JSON.parse(String(init?.body)).viewUrl;
        tv.loads++;
      } else if (u.pathname === "/stop") {
        tv.viewUrl = null;
        tv.stops++;
      }
      return new Response("{}");
    },
  });
  const castStore = createCastStore();
  startCastSync(castStore, backend.sessionManager, castCommands(), "https://stream.test");
  const config = readConfig({});
  const api = { launcherToken: async () => "launch-1" };
  const input = (deviceId: string) => ({ api, config, castStore, backend, deviceId });
  const hostOf = (deviceId: string) => (deviceId === FAKE_TV.id ? "tv1.test" : "tv2.test");
  return { tvs, backend, castStore, input, hostOf };
}

const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Switch TVs back and forth (Google Cast's real end timing)", () => {
  it.each([
    5, 40,
  ])("10 alternating switches each end with the launcher on the picked TV and the other stopped (ended after %i ms)", async (endedAfterMs) => {
    const r = room(endedAfterMs);
    await expect(castToTv(r.input(FAKE_TV.id))).resolves.toBe("started");
    await settle(5);
    const order = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? FAKE_TV_2 : FAKE_TV));
    for (const [i, tv] of order.entries()) {
      const other = tv.id === FAKE_TV.id ? FAKE_TV_2 : FAKE_TV;
      const result = await switchTv(r.input(tv.id));
      await settle(5);
      expect({ switch: i + 1, result }).toEqual({ switch: i + 1, result: "started" });
      expect(r.tvs[r.hostOf(tv.id)].viewUrl).toContain("token=launch-1");
      expect(r.tvs[r.hostOf(other.id)].viewUrl).toBeNull();
      expect(r.castStore.getSnapshot().session).toMatchObject({
        status: "connected",
        deviceId: tv.id,
        deviceName: tv.name,
      });
    }
    // Every switch stopped the old TV once and loaded the new one once.
    expect(r.tvs["tv1.test"].stops + r.tvs["tv2.test"].stops).toBe(10);
    expect(r.tvs["tv1.test"].loads + r.tvs["tv2.test"].loads).toBe(11);
  });

  // Owner, 2026-10-06: "if I want to cancel and switch to a different one" — the last tap wins.
  it("changing your mind mid-switch: the TV tapped last is where it ends, one switch at a time", async () => {
    const r = room(40);
    const sw = createCastSwitch({ castStore: r.castStore, timeoutMs: 2000 });
    await castToTv(r.input(FAKE_TV.id));
    await settle(5);
    const first = sw.run(FAKE_TV_2, () => switchTv(r.input(FAKE_TV_2.id)));
    const second = sw.run(FAKE_TV, () => switchTv(r.input(FAKE_TV.id)));
    await expect(first).resolves.toBe("superseded");
    await expect(second).resolves.toBe("started");
    await settle(5);
    expect(r.tvs["tv1.test"].viewUrl).toContain("token=launch-1");
    expect(r.tvs["tv2.test"].viewUrl).toBeNull();
    expect(r.castStore.getSnapshot().session).toMatchObject({
      status: "connected",
      deviceId: FAKE_TV.id,
    });
    expect(sw.getSnapshot()).toEqual({ status: "idle" });
  });

  it("tells the couch session the TV it ended on (tv.rename), once, after changing your mind", async () => {
    const r = room(40);
    const sent: unknown[] = [];
    const sw = createCastSwitch({
      castStore: r.castStore,
      timeoutMs: 2000,
      onSwitched: announceSwitch((m) => sent.push(m)),
    });
    await castToTv(r.input(FAKE_TV.id));
    await settle(5);
    const first = sw.run(FAKE_TV_2, () => switchTv(r.input(FAKE_TV_2.id)));
    const second = sw.run(FAKE_TV, () => switchTv(r.input(FAKE_TV.id)));
    await Promise.all([first, second]);
    expect(sent).toEqual([{ type: "tv.rename", name: FAKE_TV.name }]);
    await sw.run(FAKE_TV_2, () => switchTv(r.input(FAKE_TV_2.id)));
    expect(sent).toEqual([
      { type: "tv.rename", name: FAKE_TV.name },
      { type: "tv.rename", name: FAKE_TV_2.name },
    ]);
  });

  it("taps on the other TV and back again mid-switch: ends on the TV tapped last", async () => {
    const r = room(40);
    const sw = createCastSwitch({ castStore: r.castStore, timeoutMs: 2000 });
    await castToTv(r.input(FAKE_TV.id));
    await settle(5);
    const first = sw.run(FAKE_TV_2, () => switchTv(r.input(FAKE_TV_2.id)));
    const second = sw.run(FAKE_TV, () => switchTv(r.input(FAKE_TV.id)));
    const third = sw.run(FAKE_TV_2, () => switchTv(r.input(FAKE_TV_2.id)));
    await expect(second).resolves.toBe("superseded");
    await expect(first).resolves.toBe("started");
    await expect(third).resolves.toBe("started");
    expect(r.tvs["tv2.test"].viewUrl).toContain("token=launch-1");
    expect(r.tvs["tv1.test"].viewUrl).toBeNull();
    expect(r.castStore.getSnapshot().session).toMatchObject({
      status: "connected",
      deviceId: FAKE_TV_2.id,
    });
  });

  it("10 alternating switches through the TV picker's switch state: none fails, none is left switching", async () => {
    const r = room(20);
    const sw = createCastSwitch({ castStore: r.castStore, timeoutMs: 2000 });
    await castToTv(r.input(FAKE_TV.id));
    await settle(5);
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      const tv = i % 2 === 0 ? FAKE_TV_2 : FAKE_TV;
      results.push(await sw.run(tv, () => switchTv(r.input(tv.id))));
      expect(r.tvs[r.hostOf(tv.id)].viewUrl).toContain("token=launch-1");
    }
    expect(results).toEqual(Array(10).fill("started"));
    expect(sw.getSnapshot()).toEqual({ status: "idle" });
  });
});
