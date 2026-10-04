import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";

/** ALL /api/v1/cast/stream/:sessionId/* — the receiver's unauthenticated proxy onto /api/v1/stream. */
let forwarded: { url: string; method: string; session: string | null; body: string }[];

beforeEach(() => {
  forwarded = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    forwarded.push({
      url: req.url,
      method: req.method,
      session: req.headers.get("x-stream-session-id"),
      body: await req.text(),
    });
    return Response.json({ proxied: true });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("cast stream proxy", () => {
  it("forwards a POST with its body and query to the stream route, tagged with the session", async () => {
    const res = await app.request("https://api.test/api/v1/cast/stream/cast-1/start-stream?x=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://game.example/tv" }),
    });
    expect(await res.json()).toEqual({ proxied: true });
    expect(forwarded).toEqual([
      {
        url: "https://api.test/api/v1/stream/start-stream?x=1",
        method: "POST",
        session: "cast-1",
        body: JSON.stringify({ url: "https://game.example/tv" }),
      },
    ]);
  });

  it("forwards a GET without a body", async () => {
    await app.request("https://api.test/api/v1/cast/stream/cast-1/ice-servers");
    expect(forwarded).toEqual([
      {
        url: "https://api.test/api/v1/stream/ice-servers",
        method: "GET",
        session: "cast-1",
        body: "",
      },
    ]);
  });

  it("sends the bare session path to the stream health check", async () => {
    await app.request("https://api.test/api/v1/cast/stream/cast-1");
    expect(forwarded[0]).toMatchObject({
      url: "https://api.test/api/v1/stream/health",
      session: "cast-1",
    });
  });

  it("forwards a HEAD without a body", async () => {
    await app.request("https://api.test/api/v1/cast/stream/cast-1/health", { method: "HEAD" });
    expect(forwarded[0]).toMatchObject({
      url: "https://api.test/api/v1/stream/health",
      method: "HEAD",
    });
  });
});
