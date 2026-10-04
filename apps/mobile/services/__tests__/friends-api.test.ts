import { createFriendsApi } from "../friends-api";

const BASE = "http://api.test";
const mom = { id: "p_mom", handle: "mom.m", name: "Mom", sticker: "owl" };
const max = { id: "p_max", handle: "max.k", name: "Max", sticker: "firefly" };
const friend = { ...mom, presence: { kind: "online" }, since: 1 };
const request = { id: "r1", from: max, to: mom, via: "code", createdAt: 2 };

type Call = { url: string; method: string; auth: string | null; body: unknown };

function client(respond: (c: Call) => { status?: number; body?: unknown }) {
  const calls: Call[] = [];
  const api = createFriendsApi({
    baseUrl: BASE,
    auth: () => ({ token: "tok" }),
    fetch: async (url, init = {}) => {
      const call: Call = {
        url,
        method: init.method ?? "GET",
        auth: new Headers(init.headers).get("authorization"),
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      const { status = 200, body } = respond(call);
      return new Response(body === undefined ? null : JSON.stringify(body), { status });
    },
  });
  return { api, calls };
}

describe("friends-api", () => {
  it("lists friends with presence, with the profile token", async () => {
    const { api, calls } = client(() => ({ body: [friend] }));
    expect(await api.friends()).toEqual([friend]);
    expect(calls[0]).toEqual({
      url: `${BASE}/api/v1/friends`,
      method: "GET",
      auth: "Bearer tok",
      body: undefined,
    });
  });

  it("lists requests in and out", async () => {
    const { api, calls } = client(() => ({ body: { incoming: [request], outgoing: [] } }));
    expect(await api.requests()).toEqual({ incoming: [request], outgoing: [] });
    expect(calls[0].url).toBe(`${BASE}/api/v1/friends/requests`);
  });

  it("lists friends' live casts", async () => {
    const card = {
      sessionId: "s1",
      tvName: "Living room TV",
      host: mom,
      game: null,
      joined: false,
    };
    const { api, calls } = client(() => ({ body: [card] }));
    expect(await api.casting()).toEqual([card]);
    expect(calls[0].url).toBe(`${BASE}/api/v1/friends/casting`);
  });

  it("makes an invite", async () => {
    const inv = {
      code: "KITE-42",
      link: "https://opengame.org/add/a",
      qr: "https://opengame.org/add/b",
      expiresAt: 9,
    };
    const { api, calls } = client(() => ({ status: 201, body: inv }));
    expect(await api.createInvite()).toEqual(inv);
    expect(calls[0]).toMatchObject({ url: `${BASE}/api/v1/friends/invites`, method: "POST" });
  });

  it("redeems a code or a token and answers the outcome", async () => {
    const { api, calls } = client((c) =>
      c.body && typeof c.body === "object" && "code" in c.body
        ? { status: 201, body: { status: "requested", request } }
        : { body: { status: "friends", friend } },
    );
    expect(await api.redeem({ code: "KITE42" })).toEqual({ status: "requested", request });
    expect(await api.redeem({ token: "t".repeat(32) })).toEqual({ status: "friends", friend });
    expect(calls.map((c) => [c.url, c.method, c.body])).toEqual([
      [`${BASE}/api/v1/friends/invites/redeem`, "POST", { code: "KITE42" }],
      [`${BASE}/api/v1/friends/invites/redeem`, "POST", { token: "t".repeat(32) }],
    ]);
  });

  it("finds by @id", async () => {
    const { api, calls } = client(() => ({ status: 201, body: { status: "requested", request } }));
    await api.addByHandle("@mom.m");
    expect(calls[0]).toMatchObject({
      url: `${BASE}/api/v1/friends/requests`,
      method: "POST",
      body: { handle: "@mom.m" },
    });
  });

  it("accepts, declines and removes (204s have no body)", async () => {
    const { api, calls } = client((c) =>
      c.url.endsWith("/accept") ? { body: { status: "friends", friend } } : { status: 204 },
    );
    expect(await api.accept("r 1")).toEqual({ status: "friends", friend });
    await api.decline("r1");
    await api.remove("p_mom");
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["POST", `${BASE}/api/v1/friends/requests/r%201/accept`],
      ["POST", `${BASE}/api/v1/friends/requests/r1/decline`],
      ["DELETE", `${BASE}/api/v1/friends/p_mom`],
    ]);
  });

  it("an answer that doesn't match the protocol is BAD_RESPONSE", async () => {
    const { api } = client(() => ({ body: [{ id: "x" }] }));
    await expect(api.friends()).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("API errors keep their code", async () => {
    const { api } = client(() => ({
      status: 410,
      body: { error: { code: "invite_used", message: "used", status: 410 } },
    }));
    await expect(api.redeem({ code: "KITE42" })).rejects.toMatchObject({ code: "invite_used" });
  });
});
