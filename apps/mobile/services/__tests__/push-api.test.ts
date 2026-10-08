import { createPushApi } from "../push-api";

const handle = "ph_abcdefghijklmnop";

function fakeFetch(reply: (url: string, init: RequestInit) => { status?: number; body: unknown }) {
  const calls: { url: string; method: string; body: unknown; auth: string | null }[] = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    calls.push({
      url,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: headers.get("Authorization"),
    });
    const r = reply(url, init);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { fetch, calls };
}
const api = (f: ReturnType<typeof fakeFetch>) =>
  createPushApi({
    baseUrl: "https://api.test",
    fetch: f.fetch,
    auth: () => ({ token: "dev-token" }),
  });

describe("the app's push API", () => {
  it("opts in for a game with the profile token, joining a handle when given", async () => {
    const f = fakeFetch(() => ({ body: { status: "granted", handle } }));
    await expect(api(f).optIn("codebreakers", handle)).resolves.toEqual({
      status: "granted",
      handle,
    });
    expect(f.calls).toEqual([
      {
        url: "https://api.test/api/v1/games/codebreakers/push-handles",
        method: "POST",
        body: { handle },
        auth: "Bearer dev-token",
      },
    ]);
  });

  it("opts in with an empty body when there is no handle to join", async () => {
    const f = fakeFetch(() => ({ body: { status: "denied" } }));
    await expect(api(f).optIn("rocket-crew")).resolves.toEqual({ status: "denied" });
    expect(f.calls[0].body).toEqual({});
  });

  it("rejects an answer that isn't a consent result", async () => {
    const f = fakeFetch(() => ({ body: { status: "granted" } }));
    await expect(api(f).optIn("codebreakers")).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("lists, revokes and marks games active", async () => {
    const f = fakeFetch((url) => ({
      body: url.endsWith("/push-grants") ? { games: ["codebreakers"] } : { ok: true },
    }));
    const a = api(f);
    await expect(a.grantedGames()).resolves.toEqual(["codebreakers"]);
    await a.revoke("codebreakers");
    await a.active("codebreakers");
    expect(f.calls.every((c) => c.auth === "Bearer dev-token")).toBe(true);
    expect(f.calls.map((c) => `${c.method} ${c.url.replace("https://api.test", "")}`)).toEqual([
      "GET /api/v1/me/push-grants",
      "DELETE /api/v1/me/push-grants/codebreakers",
      "POST /api/v1/me/push-active/codebreakers",
    ]);
  });

  it("escapes the appId in paths", async () => {
    const f = fakeFetch(() => ({ body: { ok: true } }));
    await api(f).revoke("a/b");
    expect(f.calls[0].url).toBe("https://api.test/api/v1/me/push-grants/a%2Fb");
  });
});
