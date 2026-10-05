import { initialSession } from "@open-game-system/ogs-protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boot } from "./boot";
import { FIXTURE_GAMES, FIXTURE_SESSION } from "./session/fixture";

/** The browser's WebSocket, for the live client built without a `socket` option. */
class BrowserWs {
  static all: BrowserWs[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(public url: string) {
    BrowserWs.all.push(this);
  }
  send() {}
  close() {}
}

const SESSION = {
  sessionId: "s 1",
  code: "KQ7M2X",
  tvName: "Den TV",
  host: { id: "jonathan", handle: "jonathan.m", name: "Jonathan", sticker: "bear" },
};

/** The API, answering each launcher endpoint; `failures` makes the first N catalogue calls 503. */
function api(failures = 0) {
  const calls: { url: string; auth: string | null }[] = [];
  let catalogueCalls = 0;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, auth: new Headers(init?.headers).get("Authorization") });
    if (url.endsWith("/api/v1/catalogue"))
      return catalogueCalls++ < failures ? json({}, 503) : json({ games: [FIXTURE_GAMES[0]] });
    if (url.endsWith("/api/v1/me/instances")) return json({ instances: [] });
    if (url.endsWith("/api/v1/me/library")) return json({ appIds: ["rocket-crew"] });
    return json(SESSION);
  });
  return { fetch, calls, catalogueCalls: () => catalogueCalls };
}

const LIVE = {
  mode: "live" as const,
  api: "https://api.example",
  token: "tok",
  sessionId: "s 1",
};

beforeEach(() => {
  BrowserWs.all = [];
  vi.stubGlobal("window", {});
  vi.stubGlobal("WebSocket", BrowserWs);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("boot, fake mode", () => {
  it("runs an in-browser session the tests can drive through window.__ogsFake", async () => {
    const b = boot({ mode: "fake", hold: true }, "?frameTimeout=1500");
    expect(b.frameTimeoutMs).toBe(1500);
    expect(b.client.getSnapshot()).toEqual({ state: null, connection: "connecting" });
    const fake = window.__ogsFake!;
    expect(fake.state()).toBeNull();
    fake.connect();
    expect(b.client.getSnapshot().connection).toBe("open");
    expect(fake.state()).toBe(b.client.getSnapshot().state);
    fake.send({ type: "focus.set", itemId: "game:rocket-crew" });
    expect(fake.state()?.focus).toBe("game:rocket-crew");
    fake.drop();
    expect(b.client.getSnapshot().connection).toBe("reconnecting");
    fake.restore();
    expect(b.client.getSnapshot().connection).toBe("open");
    expect(BrowserWs.all).toHaveLength(0);

    const data = await b.data;
    expect(data.games.map((g) => g.appId)).toEqual(FIXTURE_GAMES.map((g) => g.appId));
    expect(data.instances.map((i) => i.instanceId)).toEqual([
      "hearthisle-night",
      "story-nook-ember",
    ]);
    expect(data.session).toEqual(FIXTURE_SESSION);
  });

  it("connects at once unless asked to hold", () => {
    const b = boot({ mode: "fake", hold: false }, "");
    expect(b.client.getSnapshot().connection).toBe("open");
    expect(b.frameTimeoutMs).toBe(20_000);
    expect(b.viewTimeoutMs).toBe(20_000);
  });

  it("gives the page one boot id that later boots keep", () => {
    boot({ mode: "fake", hold: true }, "");
    const id = window.__launcherBootId;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    boot({ mode: "fake", hold: true }, "");
    expect(window.__launcherBootId).toBe(id);
  });

  it("a fresh world has nothing played: no sittings and no paused games", async () => {
    const b = boot({ mode: "fake", hold: false, fresh: true }, "");
    expect(b.client.getSnapshot().state?.suspended).toEqual([]);
    expect((await b.data).instances).toEqual([]);
  });

  it("the usual world has the evening's sittings and Bake Shop paused", async () => {
    const b = boot({ mode: "fake", hold: false }, "");
    expect(b.client.getSnapshot().state?.suspended.map((g) => g.appId)).toEqual(["bake-shop"]);
    expect((await b.data).instances).toHaveLength(2);
  });
});

describe("boot, live mode", () => {
  it("keeps window.__ogsActivityAt for the stream server's idle stop: the cast's start, then each session change", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 4, 19, 0));
    vi.stubGlobal("fetch", api().fetch);
    boot(LIVE, "");
    const started = Date.now();
    expect(window.__ogsActivityAt).toBe(started);
    vi.advanceTimersByTime(25 * 60 * 1000);
    // Nobody on the couch session yet: the start is still the last activity.
    expect(window.__ogsActivityAt).toBe(started);
    const ws = BrowserWs.all[0]!;
    ws.readyState = 1;
    ws.onopen?.();
    ws.onmessage?.({
      data: JSON.stringify({ type: "state", state: initialSession("s 1", "jonathan") }),
    });
    expect(window.__ogsActivityAt).toBe(Date.now());
  });

  it("opens the couch socket and loads the launcher data with the token", async () => {
    const { fetch, calls } = api();
    vi.stubGlobal("fetch", fetch);
    const b = boot(LIVE, "?frameTimeout=900&viewTimeout=1100");
    expect(b.frameTimeoutMs).toBe(900);
    expect(b.viewTimeoutMs).toBe(1100);
    expect(BrowserWs.all.map((w) => w.url)).toEqual([
      "wss://api.example/api/v1/couch/ws?token=tok",
    ]);
    expect(window.__ogsFake).toBeUndefined();
    const data = await b.data;
    expect(data).toEqual({ games: [FIXTURE_GAMES[0]], instances: [], session: SESSION });
    expect(calls.map((c) => c.url).sort()).toEqual([
      "https://api.example/api/v1/catalogue",
      "https://api.example/api/v1/me/instances",
      "https://api.example/api/v1/me/library",
      "https://api.example/api/v1/sessions/s%201",
    ]);
    expect(calls.every((c) => c.auth === "Bearer tok")).toBe(true);
  });

  it("retries the launcher data with a growing, capped wait, and says so", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const server = api(6);
    vi.stubGlobal("fetch", server.fetch);
    const b = boot(LIVE, "");
    let settled = false;
    b.data.then(() => {
      settled = true;
    });
    // Waits after each failure: 1 s, 2 s, 4 s, 8 s, then capped at 10 s.
    for (const waitMs of [1000, 2000, 4000, 8000, 10_000, 10_000]) {
      const before = server.catalogueCalls();
      await vi.advanceTimersByTimeAsync(waitMs - 1);
      expect(server.catalogueCalls()).toBe(before);
      await vi.advanceTimersByTimeAsync(1);
      expect(server.catalogueCalls()).toBe(before + 1);
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    expect(warn).toHaveBeenCalledTimes(6);
    expect(warn.mock.calls[0]?.[0]).toBe("[tv] launcher data failed, retrying");
    expect(warn.mock.calls[0]?.[1]).toBeInstanceOf(Error);
  });
});
