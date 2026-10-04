import { createOgsApi, OgsApiError } from "../ogs-api";

const BASE = "http://api.test";

const manifest = (appId: string, extra: Record<string, unknown> = {}) => ({
  appId,
  name: appId.replace("-", " "),
  shape: "couch",
  tv: "required",
  startUrl: `https://${appId}.example/`,
  tvUrl: `https://${appId}.example/tv`,
  art: { tile: `/art/${appId}/tv.jpg` },
  ...extra,
});

const instance = (instanceId: string, extra: Record<string, unknown> = {}) => ({
  instanceId,
  appId: "rocket-crew",
  householdId: "h1",
  status: "suspended",
  title: "Mission 6",
  detail: "",
  updatedAt: 1000,
  source: "bridge",
  ...extra,
});

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

function fakeFetch(respond: (call: Call) => { status?: number; body: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = jest.fn(async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      url,
      method: init.method ?? "GET",
      headers: (init.headers as Record<string, string>) ?? {},
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const { status = 200, body } = respond(call);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  });
  return { calls, fetchImpl };
}

function api(respond: (call: Call) => { status?: number; body: unknown }, token = "tok") {
  const f = fakeFetch(respond);
  const client = createOgsApi({
    baseUrl: BASE,
    fetch: f.fetchImpl,
    auth: () => (token ? { householdId: "h1", token } : null),
  });
  return { client, ...f };
}

describe("ogs-api: households", () => {
  it("creates a household with its people and this phone, and returns its identity", async () => {
    const { client, calls } = api(() => ({
      status: 201,
      body: {
        householdId: "h1",
        token: "jwt",
        people: [{ id: "p1", name: "Jonathan", band: "grownup", sticker: "bear" }],
      },
    }));
    const out = await client.createHousehold({
      name: "The Mumms",
      people: [{ name: "Jonathan", band: "grownup", sticker: "bear" }],
      device: { deviceId: "d1", name: "Jonathan's phone", personIndex: 0 },
    });
    expect(out).toEqual({
      householdId: "h1",
      deviceId: "d1",
      token: "jwt",
      people: [{ personId: "p1", name: "Jonathan", band: "grownup", sticker: "bear" }],
    });
    expect(calls[0]).toMatchObject({
      url: `${BASE}/api/v1/households`,
      method: "POST",
      body: {
        name: "The Mumms",
        device: { deviceId: "d1", kind: "phone", name: "Jonathan's phone", personIndex: 0 },
      },
    });
  });

  it("rejects a malformed household response at the boundary", async () => {
    const { client } = api(() => ({ body: { householdId: "h1" } }));
    await expect(
      client.createHousehold({ name: "x", people: [], device: { deviceId: "d", name: "p" } }),
    ).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("asks for a launcher token with the device token", async () => {
    const { client, calls } = api(() => ({ status: 201, body: { token: "launch-jwt" } }));
    expect(await client.launcherToken()).toBe("launch-jwt");
    expect(calls[0]).toMatchObject({
      url: `${BASE}/api/v1/households/h1/launcher-token`,
      method: "POST",
      headers: { Authorization: "Bearer tok" },
    });
  });

  it("refuses household calls before a household exists", async () => {
    const { client, fetchImpl } = api(() => ({ body: {} }), "");
    await expect(client.launcherToken()).rejects.toMatchObject({ code: "NO_HOUSEHOLD" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("ogs-api: catalogue and library", () => {
  it("parses the catalogue's manifests and skips any that don't parse", async () => {
    const { client, calls } = api(() => ({
      body: [manifest("rocket-crew"), { appId: "BROKEN" }, manifest("word-duel", { tv: "none" })],
    }));
    const games = await client.catalogue();
    expect(games.map((g) => g.appId)).toEqual(["rocket-crew", "word-duel"]);
    expect(games[0]?.instanceTtlMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(calls[0]?.url).toBe(`${BASE}/api/v1/catalogue`);
  });

  it("reads the household's library as appIds", async () => {
    const { client, calls } = api(() => ({ body: { appIds: ["night-flight"] } }));
    expect(await client.library()).toEqual(["night-flight"]);
    expect(calls[0]?.url).toBe(`${BASE}/api/v1/households/h1/library`);
  });

  it("replaces the library with PUT", async () => {
    const { client, calls } = api(() => ({ body: { appIds: ["rocket-crew", "night-flight"] } }));
    expect(await client.setLibrary(["rocket-crew", "night-flight"])).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      method: "PUT",
      body: { appIds: ["rocket-crew", "night-flight"] },
    });
  });

  it("Add by link fetches and parses the game's manifest", async () => {
    const { client, calls } = api(() => ({ body: manifest("my-game") }));
    expect((await client.fetchManifest("https://me.example/ogs.json")).appId).toBe("my-game");
    expect(calls[0]?.url).toBe("https://me.example/ogs.json");
  });

  it("Add by link refuses something that isn't a manifest", async () => {
    const { client } = api(() => ({ body: { hello: "world" } }));
    await expect(client.fetchManifest("https://me.example/x")).rejects.toMatchObject({
      code: "BAD_MANIFEST",
    });
  });
});

describe("ogs-api: instances", () => {
  it("lists the household's instances, dropping malformed ones", async () => {
    const { client } = api(() => ({ body: [instance("i1"), { instanceId: 3 }] }));
    expect((await client.instances()).map((i) => i.instanceId)).toEqual(["i1"]);
  });

  it("posts a report with its source", async () => {
    const { client, calls } = api(() => ({ body: instance("i1") }));
    const report = {
      instanceId: "i1",
      appId: "rocket-crew",
      status: "suspended" as const,
      title: "Mission 6",
      detail: "",
    };
    const out = await client.reportInstance(report, "bridge");
    expect(out.instanceId).toBe("i1");
    expect(calls[0]).toMatchObject({
      url: `${BASE}/api/v1/households/h1/instances`,
      method: "POST",
      body: { ...report, source: "bridge" },
    });
  });
});

describe("ogs-api: errors", () => {
  it("surfaces the API's error contract", async () => {
    const { client } = api(() => ({
      status: 401,
      body: { error: { code: "UNAUTHORIZED", message: "Bad token", status: 401 } },
    }));
    const err = await client.library().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OgsApiError);
    expect(err).toMatchObject({ code: "UNAUTHORIZED", message: "Bad token", status: 401 });
  });

  it("names a non-JSON failure by its HTTP status", async () => {
    const { client } = api(() => ({ status: 502, body: "<html>bad gateway</html>" }));
    await expect(client.catalogue()).rejects.toMatchObject({ code: "HTTP_502", status: 502 });
  });

  it("turns a network failure into an OFFLINE error", async () => {
    const client = createOgsApi({
      baseUrl: BASE,
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
      auth: () => null,
    });
    await expect(client.catalogue()).rejects.toMatchObject({ code: "OFFLINE", status: 0 });
  });
});
