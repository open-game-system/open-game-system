import { afterEach, describe, expect, it, vi } from "vitest";
import { createOgsNotifier, DEFAULT_OGS_API_URL, OgsNotifyError } from "./index";

/** The game server's side of pushes (spec §9): one call per moment, with the game's API key. */
const handle = "ph_abcdefghijklmnop";

function stub(answer: { status?: number; body: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
  };
  return { calls, fetch };
}

describe("createOgsNotifier", () => {
  it("posts to the game's notifications route with its API key and answers the results", async () => {
    const s = stub({ body: { results: [{ to: handle, status: "sent" }] } });
    const notify = createOgsNotifier({
      appId: "codebreakers",
      apiKey: "ogsk_k",
      baseUrl: "https://api.test",
      fetch: s.fetch,
    });
    const message = {
      to: [handle],
      title: "Clue: RIVER 2",
      body: "Your guess.",
      url: "https://cb.example/r/K",
      tag: "cb-K",
      whenOpen: "banner" as const,
    };
    await expect(notify(message)).resolves.toEqual({ results: [{ to: handle, status: "sent" }] });
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]?.url).toBe("https://api.test/api/v1/games/codebreakers/notifications");
    expect(s.calls[0]?.init.method).toBe("POST");
    const headers = new Headers(s.calls[0]?.init.headers);
    expect(headers.get("Authorization")).toBe("Bearer ogsk_k");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(s.calls[0]?.init.body))).toEqual(message);
  });

  it("defaults to the production OGS API, and escapes the appId", async () => {
    const s = stub({ body: { results: [] } });
    await createOgsNotifier({ appId: "a/b", apiKey: "k", fetch: s.fetch })({
      to: [handle],
      title: "t",
      body: "b",
    });
    expect(s.calls[0]?.url).toBe(`${DEFAULT_OGS_API_URL}/api/v1/games/a%2Fb/notifications`);
    expect(DEFAULT_OGS_API_URL).toBe("https://api.opengame.org");
  });

  it("checks the message before sending (title ≤ 60, 1-100 handles)", async () => {
    const s = stub({ body: { results: [] } });
    const notify = createOgsNotifier({ appId: "codebreakers", apiKey: "k", fetch: s.fetch });
    await expect(notify({ to: [], title: "t", body: "b" })).rejects.toThrow();
    await expect(notify({ to: [handle], title: "t".repeat(61), body: "b" })).rejects.toThrow();
    expect(s.calls).toEqual([]);
  });

  it("throws OgsNotifyError with the API's error code and status", async () => {
    const s = stub({
      status: 403,
      body: {
        error: { code: "wrong_game", message: "This API key belongs to another game", status: 403 },
      },
    });
    const notify = createOgsNotifier({ appId: "codebreakers", apiKey: "k", fetch: s.fetch });
    const err = await notify({ to: [handle], title: "t", body: "b" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OgsNotifyError);
    expect(err).toMatchObject({
      code: "wrong_game",
      status: 403,
      message: "This API key belongs to another game",
      name: "OgsNotifyError",
    });
  });

  it("an error body that isn't the OGS shape still throws, with the HTTP status", async () => {
    const s = stub({ status: 502, body: "bad gateway" });
    const err = await createOgsNotifier({ appId: "c", apiKey: "k", fetch: s.fetch })({
      to: [handle],
      title: "t",
      body: "b",
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({
      code: "http_error",
      status: 502,
      message: "OGS answered HTTP 502",
    });
  });

  it("a 200 that isn't results throws", async () => {
    const s = stub({ body: { nope: true } });
    await expect(
      createOgsNotifier({ appId: "c", apiKey: "k", fetch: s.fetch })({
        to: [handle],
        title: "t",
        body: "b",
      }),
    ).rejects.toThrow();
  });
});

describe("without a fetch option", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the global fetch", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return Response.json({ results: [] });
    });
    await createOgsNotifier({ appId: "c", apiKey: "k" })({ to: [handle], title: "t", body: "b" });
    expect(urls).toEqual([`${DEFAULT_OGS_API_URL}/api/v1/games/c/notifications`]);
  });
});
