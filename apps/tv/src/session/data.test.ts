import { describe, expect, it } from "vitest";
import { fetchLauncherData, libraryGames, liveSession, stickerUrl } from "./data";
import { FIXTURE_GAMES, FIXTURE_SESSION, fixtureInstances } from "./fixture";

function fakeFetch(routes: Record<string, unknown>) {
  const calls: { url: string; auth: string | null }[] = [];
  const f: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, auth: new Headers(init?.headers).get("Authorization") });
    const path = new URL(url).pathname;
    if (!(path in routes)) return new Response("nope", { status: 404 });
    return new Response(JSON.stringify(routes[path]), { status: 200 });
  };
  return { f, calls };
}

const routes = (over: Record<string, unknown> = {}) => ({
  "/api/v1/catalogue": { games: FIXTURE_GAMES },
  "/api/v1/sessions/s1": FIXTURE_SESSION,
  "/api/v1/me/instances": fixtureInstances(1_000_000),
  "/api/v1/me/library": { appIds: ["night-flight", "rocket-crew"] },
  ...over,
});

describe("launcher data", () => {
  it("fetches the catalogue, the session, the host's instances and library with the bearer", async () => {
    const { f, calls } = fakeFetch(routes());
    const data = await fetchLauncherData({
      api: "http://api",
      token: "tok",
      sessionId: "s1",
      fetch: f,
    });
    expect(data.session).toEqual(FIXTURE_SESSION);
    expect(data.instances).toHaveLength(2);
    expect(data.games.map((g) => g.appId)).toEqual(["night-flight", "rocket-crew"]);
    expect(calls.map((c) => new URL(c.url).pathname).sort()).toEqual([
      "/api/v1/catalogue",
      "/api/v1/me/instances",
      "/api/v1/me/library",
      "/api/v1/sessions/s1",
    ]);
    expect(calls.every((c) => c.auth === "Bearer tok")).toBe(true);
  });

  it("escapes the session id in the path", async () => {
    const { f, calls } = fakeFetch(routes({ "/api/v1/sessions/a%2Fb": FIXTURE_SESSION }));
    await fetchLauncherData({ api: "http://api", token: "t", sessionId: "a/b", fetch: f });
    expect(calls.some((c) => c.url === "http://api/api/v1/sessions/a%2Fb")).toBe(true);
  });

  it("accepts bare arrays and drops entries that don't parse", async () => {
    const { f } = fakeFetch(
      routes({
        "/api/v1/catalogue": [FIXTURE_GAMES[0], { appId: "Bad Id" }],
        "/api/v1/me/instances": { instances: [{ instanceId: "broken" }] },
        "/api/v1/me/library": { appIds: ["rocket-crew", "bad-id"] },
      }),
    );
    const data = await fetchLauncherData({
      api: "http://api",
      token: "t",
      sessionId: "s1",
      fetch: f,
    });
    expect(data.games.map((g) => g.appId)).toEqual(["rocket-crew"]);
    expect(data.instances).toEqual([]);
  });

  it("fails on a session that doesn't parse", async () => {
    const { f } = fakeFetch(routes({ "/api/v1/sessions/s1": { sessionId: "s1" } }));
    await expect(
      fetchLauncherData({ api: "http://api", token: "t", sessionId: "s1", fetch: f }),
    ).rejects.toThrow();
  });

  it("fails on an HTTP error", async () => {
    const { f } = fakeFetch({});
    await expect(
      fetchLauncherData({ api: "http://api", token: "t", sessionId: "s1", fetch: f }),
    ).rejects.toThrow("404");
  });

  it("maps sticker ids to the painted set and passes URLs through", () => {
    expect(stickerUrl("owl")).toBe("/art/story-nook/char-owl.webp");
    expect(stickerUrl("https://x/y.webp")).toBe("https://x/y.webp");
  });
});

describe("the TV's name in the header", () => {
  // Owner, 2026-10-06: after Change TV the new TV's header still named the old TV.
  it("is the session's created name until the cast moves", () => {
    expect(liveSession(FIXTURE_SESSION, {})).toEqual(FIXTURE_SESSION);
  });

  it("is the TV the cast moved to (the session state's tvName)", () => {
    expect(liveSession(FIXTURE_SESSION, { tvName: "Bedroom TV" })).toEqual({
      ...FIXTURE_SESSION,
      tvName: "Bedroom TV",
    });
  });
});

describe("the host's library", () => {
  it("keeps only the games in the library, in the library's order", () => {
    const games = libraryGames(FIXTURE_GAMES, ["hearthisle", "rocket-crew", "bake-shop"]);
    expect(games.map((g) => g.appId)).toEqual(["hearthisle", "rocket-crew", "bake-shop"]);
  });

  it("skips ids the catalogue doesn't know and repeats", () => {
    const games = libraryGames(FIXTURE_GAMES, ["gone", "bake-shop", "bake-shop"]);
    expect(games.map((g) => g.appId)).toEqual(["bake-shop"]);
  });

  it("is empty for an empty library", () => {
    expect(libraryGames(FIXTURE_GAMES, [])).toEqual([]);
  });
});
