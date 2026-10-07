import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";

/**
 * The stream server passthroughs (health, debug-state, publisher/*) and the heartbeat. The only
 * renderer is the Cloud Run stream server named by STREAM_SERVER_URL; without it every route that
 * needs it answers `stream_not_configured` in the API's error shape and calls nothing.
 */
const SERVER = "https://stream.example.run.app";
const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  fetchSpy.mockResolvedValue(Response.json({ status: "ok" }));
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => vi.unstubAllGlobals());

function createMockEnv(over: Record<string, unknown> = {}) {
  return {
    OGS_JWT_SECRET: "test-jwt-secret",
    CLOUDFLARE_TURN_API_TOKEN: "test-turn-token",
    CLOUDFLARE_TURN_KEY_ID: "test-turn-key-id",
    CLOUDFLARE_REALTIME_APP_ID: "test-app-id",
    CLOUDFLARE_REALTIME_APP_SECRET: "test-app-secret",
    STREAM_SERVER_URL: SERVER,
    ...over,
  };
}

/** The one request the route sent to the stream server. */
function forwarded(): Request {
  expect(fetchSpy).toHaveBeenCalledOnce();
  const [input, init] = fetchSpy.mock.calls[0];
  return new Request(input, init);
}

const NOT_CONFIGURED = {
  code: "stream_not_configured",
  message: "STREAM_SERVER_URL must be configured",
  status: 500,
};

describe("stream server passthroughs", () => {
  it("POST /publisher/prepare forwards its body to the stream server's bare path", async () => {
    const body = JSON.stringify({ url: "https://example.com/game", iceServers: [] });
    const res = await app.request(
      "/api/v1/stream/publisher/prepare",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-stream-session-id": "test-session",
          "x-stream-trace-id": "trace-9",
        },
        body,
      },
      createMockEnv(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    const req = forwarded();
    expect(req.url).toBe(`${SERVER}/publisher/prepare`);
    expect(req.method).toBe("POST");
    expect(req.headers.get("x-stream-trace-id")).toBe("trace-9");
    expect(req.headers.get("x-stream-session-id")).toBe("test-session");
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(await req.text()).toBe(body);
  });

  it("POST /publisher/answer forwards to the stream server", async () => {
    const res = await app.request(
      "/api/v1/stream/publisher/answer",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDescription: { type: "answer", sdp: "v=0\r\n..." } }),
      },
      createMockEnv(),
    );
    expect(res.status).toBe(200);
    expect(forwarded().url).toBe(`${SERVER}/publisher/answer`);
  });

  it.each([
    ["/publisher/state"],
    ["/health"],
    ["/debug-state"],
  ])("GET %s forwards to the stream server without a body, with a trace id", async (path) => {
    const res = await app.request(`/api/v1/stream${path}`, { method: "GET" }, createMockEnv());
    expect(res.status).toBe(200);
    const req = forwarded();
    expect(req.url).toBe(`${SERVER}${path}`);
    expect(req.method).toBe("GET");
    expect(req.headers.get("x-stream-trace-id")).toMatch(/.+/);
    expect(req.headers.get("x-stream-session-id")).toBeNull();
    expect(await req.text()).toBe("");
  });

  it("passes the stream server's status and body through", async () => {
    fetchSpy.mockResolvedValue(new Response("chrome crashed", { status: 503 }));
    const res = await app.request("/api/v1/stream/health", {}, createMockEnv());
    expect(res.status).toBe(503);
    expect(await res.text()).toBe("chrome crashed");
  });

  it.each([
    ["POST", "/publisher/prepare"],
    ["POST", "/publisher/answer"],
    ["GET", "/publisher/state"],
    ["GET", "/health"],
    ["GET", "/debug-state"],
  ])("%s %s answers stream_not_configured without STREAM_SERVER_URL", async (method, path) => {
    for (const STREAM_SERVER_URL of [undefined, ""]) {
      const res = await app.request(
        `/api/v1/stream${path}`,
        {
          method,
          headers: { "Content-Type": "application/json", "x-stream-trace-id": "trace-1" },
          body: method === "POST" ? "{}" : undefined,
        },
        createMockEnv({ STREAM_SERVER_URL }),
      );
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: NOT_CONFIGURED, traceId: "trace-1" });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── POST /heartbeat ───
// While a TV is casting, the receiver pings this so the stream server stays up for the whole game
// (the video goes to the SFU, not through the server, so Cloud Run would otherwise see an idle instance).

describe("POST /api/v1/stream/heartbeat", () => {
  it("pings the stream server (Cloud Run)", async () => {
    fetchSpy.mockResolvedValue(Response.json({ status: "pong" }));
    const res = await app.request("/api/v1/stream/heartbeat", { method: "POST" }, createMockEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      `${SERVER}/ping`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("passes 410 through when the stream hit its maximum lifetime (the receiver stops pinging)", async () => {
    fetchSpy.mockResolvedValue(Response.json({ status: "expired" }, { status: 410 }));
    const res = await app.request("/api/v1/stream/heartbeat", { method: "POST" }, createMockEnv());
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ expired: true });
  });

  it("reports the stream server being down as 502", async () => {
    fetchSpy.mockRejectedValue(new Error("unreachable"));
    const res = await app.request("/api/v1/stream/heartbeat", { method: "POST" }, createMockEnv());
    expect(res.status).toBe(502);
  });

  it("reports a failing stream server as 502", async () => {
    fetchSpy.mockResolvedValue(new Response("no", { status: 500 }));
    const res = await app.request("/api/v1/stream/heartbeat", { method: "POST" }, createMockEnv());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false });
  });

  it("answers stream_not_configured without STREAM_SERVER_URL", async () => {
    const res = await app.request(
      "/api/v1/stream/heartbeat",
      { method: "POST", headers: { "x-stream-trace-id": "trace-1" } },
      createMockEnv({ STREAM_SERVER_URL: undefined }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: NOT_CONFIGURED, traceId: "trace-1" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
