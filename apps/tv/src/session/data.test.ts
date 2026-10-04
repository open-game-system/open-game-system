import { describe, expect, it } from "vitest";
import { fetchLauncherData, stickerUrl } from "./data";
import { FIXTURE_GAMES, FIXTURE_HOUSEHOLD, fixtureInstances } from "./fixture";

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

describe("launcher data", () => {
  it("fetches catalogue, instances and household with the bearer token", async () => {
    const { f, calls } = fakeFetch({
      "/api/v1/catalogue": { games: FIXTURE_GAMES },
      "/api/v1/households/mumms/instances": { instances: fixtureInstances(1_000_000) },
      "/api/v1/households/mumms": { household: FIXTURE_HOUSEHOLD },
    });
    const data = await fetchLauncherData({
      api: "http://api",
      token: "tok",
      householdId: "mumms",
      fetch: f,
    });
    expect(data.games.map((g) => g.appId)).toEqual(FIXTURE_GAMES.map((g) => g.appId));
    expect(data.instances).toHaveLength(2);
    expect(data.household.people.map((p) => p.name)).toEqual(["Jonathan", "Mom", "Juneau", "Ava"]);
    expect(calls.every((c) => c.auth === "Bearer tok")).toBe(true);
  });

  it("accepts bare arrays and drops entries that don't parse", async () => {
    const { f } = fakeFetch({
      "/api/v1/catalogue": [FIXTURE_GAMES[0], { appId: "Bad Id" }],
      "/api/v1/households/h/instances": [],
      "/api/v1/households/h": FIXTURE_HOUSEHOLD,
    });
    const data = await fetchLauncherData({
      api: "http://api",
      token: "t",
      householdId: "h",
      fetch: f,
    });
    expect(data.games.map((g) => g.appId)).toEqual(["rocket-crew"]);
  });

  it("fails on an HTTP error", async () => {
    const { f } = fakeFetch({});
    await expect(
      fetchLauncherData({ api: "http://api", token: "t", householdId: "h", fetch: f }),
    ).rejects.toThrow("404");
  });

  it("maps sticker ids to the painted set and passes URLs through", () => {
    expect(stickerUrl("owl")).toBe("/art/story-nook/char-owl.webp");
    expect(stickerUrl("https://x/y.webp")).toBe("https://x/y.webp");
  });
});
