jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

import type { ClientMessage } from "@open-game-system/ogs-protocol";
import { castToTv, createGameCastStore, endForTonight, switchTv } from "../cast-flow";
import { createCastStore } from "../cast-store";
import { castCommands, startCastSync } from "../cast-sync";
import { readConfig } from "../config";
import { createFakeCastBackend, FAKE_TV } from "../fake-cast";

const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
};

function setup() {
  const loads: string[] = [];
  const backend = createFakeCastBackend({
    mode: "one",
    loadUrl: "http://fake.test/load",
    fetch: async (_url, init) => {
      loads.push(JSON.parse(String(init?.body)).viewUrl);
      return new Response("{}");
    },
  });
  const castStore = createCastStore();
  const commands = castCommands();
  startCastSync(castStore, backend.sessionManager, commands, "https://stream.test");
  const config = readConfig({});
  const api = { launcherToken: jest.fn(async () => "launch-1") };
  const sent: ClientMessage[] = [];
  return { loads, backend, castStore, config, api, sent, send: (m: ClientMessage) => sent.push(m) };
}

describe("Cast from the TV tab (spec v3, Architecture: Cast)", () => {
  it("loads the launcher once, with a launcher token, on the picked TV", async () => {
    const t = setup();
    await castToTv({ ...t, deviceId: FAKE_TV.id });
    await flush();
    expect(t.api.launcherToken).toHaveBeenCalledTimes(1);
    expect(t.loads).toEqual([
      "http://localhost:5180/?api=http%3A%2F%2Flocalhost%3A8787&token=launch-1",
    ]);
    expect(t.castStore.getSnapshot().session.status).toBe("connected");
  });

  it("returns a no-TV result when the TV can't be reached", async () => {
    const t = setup();
    await expect(castToTv({ ...t, deviceId: "missing" })).resolves.toBe("no-tv");
    expect(t.loads).toEqual([]);
  });

  it("a game's TV page while cast goes to the session as game.view: still exactly one load", async () => {
    const t = setup();
    await castToTv({ ...t, deviceId: FAKE_TV.id });
    await flush();
    const gameStore = createGameCastStore(
      t.castStore,
      () => ({ ogsCast: true, appId: "rocket-crew" }),
      t.send,
    );
    gameStore.dispatch({ type: "SET_VIEW_URL", url: "https://rc.example/tv/AB" });
    gameStore.dispatch({ type: "SET_VIEW_URL", url: "https://bake.example/tv/CD" });
    await flush();
    expect(t.loads).toHaveLength(1);
    expect(t.sent).toEqual([
      { type: "game.view", appId: "rocket-crew", url: "https://rc.example/tv/AB" },
      { type: "game.view", appId: "rocket-crew", url: "https://bake.example/tv/CD" },
    ]);
  });

  it("not cast through OGS: the game's TV page keeps the old LOAD_VIEW path", async () => {
    const t = setup();
    const gameStore = createGameCastStore(
      t.castStore,
      () => ({ ogsCast: false, appId: "rocket-crew" }),
      t.send,
    );
    gameStore.dispatch({ type: "SET_VIEW_URL", url: "https://rc.example/tv/AB" });
    expect(t.castStore.getSnapshot().viewUrl).toBe("https://rc.example/tv/AB");
    expect(t.sent).toEqual([]);
  });

  it("the game sees the app's cast state through its store", () => {
    const t = setup();
    const gameStore = createGameCastStore(
      t.castStore,
      () => ({ ogsCast: false, appId: null }),
      t.send,
    );
    const seen = jest.fn();
    const off = gameStore.subscribe(seen);
    t.castStore.dispatch({ type: "DEVICES_UPDATED", devices: [FAKE_TV] });
    expect(gameStore.getSnapshot().devices).toEqual([FAKE_TV]);
    expect(seen).toHaveBeenCalled();
    off();
  });

  it("End for tonight sends end and stops casting", async () => {
    const t = setup();
    await castToTv({ ...t, deviceId: FAKE_TV.id });
    await flush();
    await endForTonight({ send: t.send, sessionManager: t.backend.sessionManager });
    expect(t.sent).toEqual([{ type: "end" }]);
    expect(t.castStore.getSnapshot().session.status).toBe("disconnected");
  });
});

describe("Switch TV from the remote's TV picker", () => {
  /** A session manager that records what it was asked to do, with two TVs in the room. */
  function twoTvs(reachable = ["den", "living"]) {
    const calls: string[] = [];
    const base = setup().backend.sessionManager;
    const sessionManager = {
      ...base,
      async startSession(id: string) {
        calls.push(`start:${id}`);
        return reachable.includes(id);
      },
      async endCurrentSession(stop?: boolean) {
        calls.push(`end:${String(stop)}`);
      },
    };
    return { calls, backend: { sessionManager } };
  }

  it("stops the old TV, then casts the launcher to the new one with a fresh token", async () => {
    const t = setup();
    const tvs = twoTvs();
    t.castStore.dispatch({ type: "START_CASTING", deviceId: "living" });
    await expect(switchTv({ ...t, backend: tvs.backend, deviceId: "den" })).resolves.toBe(
      "started",
    );
    expect(tvs.calls).toEqual(["end:true", "start:den"]);
    expect(t.api.launcherToken).toHaveBeenCalledTimes(1);
    expect(t.castStore.getSnapshot().viewUrl).toContain("token=launch-1");
  });

  it("does not end the couch session (the game keeps its place on the new TV)", async () => {
    const t = setup();
    const tvs = twoTvs();
    await switchTv({ ...t, backend: tvs.backend, deviceId: "den" });
    expect(t.sent).toEqual([]);
  });

  it("picking the TV you're already on does nothing", async () => {
    const t = setup();
    await castToTv({ ...t, deviceId: FAKE_TV.id });
    await flush();
    await expect(switchTv({ ...t, deviceId: FAKE_TV.id })).resolves.toBe("same");
    expect(t.api.launcherToken).toHaveBeenCalledTimes(1);
    expect(t.loads).toHaveLength(1);
    expect(t.castStore.getSnapshot().session.status).toBe("connected");
  });

  it("a new TV that can't be reached reports no-TV (the old one was already stopped)", async () => {
    const t = setup();
    const tvs = twoTvs(["living"]);
    await expect(switchTv({ ...t, backend: tvs.backend, deviceId: "den" })).resolves.toBe("no-tv");
    expect(tvs.calls).toEqual(["end:true", "start:den"]);
  });
});
