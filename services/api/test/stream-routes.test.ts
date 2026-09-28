import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";

const mockStubFetch = vi.fn();

function createMockEnv() {
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        })),
      })),
    },
    OGS_JWT_SECRET: "test-jwt-secret",
    STREAM_CONTAINER: {
      idFromName: vi.fn((name: string) => ({ name })),
      get: vi.fn(() => ({ fetch: mockStubFetch })),
    },
    CLOUDFLARE_TURN_API_TOKEN: "test-turn-token",
    CLOUDFLARE_TURN_KEY_ID: "test-turn-key-id",
    CLOUDFLARE_REALTIME_APP_ID: "test-app-id",
    CLOUDFLARE_REALTIME_APP_SECRET: "test-app-secret",
  };
}

describe("Stream Routes — SFU endpoints", () => {
  beforeEach(() => {
    mockStubFetch.mockReset();
  });

  // ─── POST /publisher/prepare ───

  describe("POST /api/v1/stream/publisher/prepare", () => {
    it("forwards to StreamContainer DO with rewritten path", async () => {
      const containerResponse = {
        sessionDescription: { type: "offer", sdp: "v=0\r\n..." },
        tracks: [{ location: "local", trackName: "cast-video" }],
        traceId: "trace-123",
      };
      mockStubFetch.mockResolvedValue(
        new Response(JSON.stringify(containerResponse), { status: 200 }),
      );

      const env = createMockEnv();
      const res = await app.request(
        "/api/v1/stream/publisher/prepare",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-stream-session-id": "test-session",
          },
          body: JSON.stringify({
            url: "https://example.com/game",
            iceServers: [],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(mockStubFetch).toHaveBeenCalledOnce();

      // Verify path rewriting: should be /publisher/prepare (not /api/v1/stream/publisher/prepare)
      const forwardedReq = mockStubFetch.mock.calls[0][0] as Request;
      expect(new URL(forwardedReq.url).pathname).toBe("/publisher/prepare");
    });

    it("uses session ID header for DO instance name", async () => {
      mockStubFetch.mockResolvedValue(new Response("{}", { status: 200 }));
      const env = createMockEnv();

      await app.request(
        "/api/v1/stream/publisher/prepare",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-stream-session-id": "my-session-42",
          },
          body: JSON.stringify({ url: "https://example.com", iceServers: [] }),
        },
        env,
      );

      expect(env.STREAM_CONTAINER.idFromName).toHaveBeenCalledWith("session-my-session-42");
    });

    it("uses default instance name without session ID", async () => {
      mockStubFetch.mockResolvedValue(new Response("{}", { status: 200 }));
      const env = createMockEnv();

      await app.request(
        "/api/v1/stream/publisher/prepare",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://example.com", iceServers: [] }),
        },
        env,
      );

      expect(env.STREAM_CONTAINER.idFromName).toHaveBeenCalledWith("default-singleton-debug-v3");
    });
  });

  // ─── POST /publisher/answer ───

  describe("POST /api/v1/stream/publisher/answer", () => {
    it("forwards to StreamContainer DO with rewritten path", async () => {
      mockStubFetch.mockResolvedValue(
        new Response(JSON.stringify({ status: "success", traceId: "t-1" }), { status: 200 }),
      );

      const env = createMockEnv();
      const res = await app.request(
        "/api/v1/stream/publisher/answer",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-stream-session-id": "session-1",
          },
          body: JSON.stringify({
            sessionDescription: { type: "answer", sdp: "v=0\r\n..." },
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(mockStubFetch).toHaveBeenCalledOnce();
      const forwardedReq = mockStubFetch.mock.calls[0][0] as Request;
      expect(new URL(forwardedReq.url).pathname).toBe("/publisher/answer");
    });
  });

  // ─── GET /publisher/state ───

  describe("GET /api/v1/stream/publisher/state", () => {
    it("forwards to StreamContainer DO with rewritten path", async () => {
      const stateResponse = {
        browser: "running",
        extension: "loaded",
        connections: [],
      };
      mockStubFetch.mockResolvedValue(
        new Response(JSON.stringify(stateResponse), { status: 200 }),
      );

      const env = createMockEnv();
      const res = await app.request(
        "/api/v1/stream/publisher/state",
        {
          method: "GET",
          headers: { "x-stream-session-id": "session-1" },
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(mockStubFetch).toHaveBeenCalledOnce();
      const forwardedReq = mockStubFetch.mock.calls[0][0] as Request;
      expect(new URL(forwardedReq.url).pathname).toBe("/publisher/state");
    });
  });

  // ─── Existing routes still work ───

  describe("existing routes", () => {
    it("GET /api/v1/stream/health still forwards to DO", async () => {
      mockStubFetch.mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      );

      const env = createMockEnv();
      const res = await app.request(
        "/api/v1/stream/health",
        { method: "GET" },
        env,
      );

      expect(res.status).toBe(200);
      expect(mockStubFetch).toHaveBeenCalledOnce();
    });

    it("GET /api/v1/stream/debug-state still forwards to DO", async () => {
      mockStubFetch.mockResolvedValue(
        new Response(JSON.stringify({ state: {} }), { status: 200 }),
      );

      const env = createMockEnv();
      const res = await app.request(
        "/api/v1/stream/debug-state",
        { method: "GET" },
        env,
      );

      expect(res.status).toBe(200);
    });
  });
});

// ─── POST /heartbeat ───
// While a TV is casting, the receiver pings this so the stream server stays up for the whole game
// (the video goes to the SFU, not through the server, so Cloud Run would otherwise see an idle instance).

describe("POST /api/v1/stream/heartbeat", () => {
  beforeEach(() => {
    mockStubFetch.mockReset();
  });

  it("pings the direct stream server (Cloud Run) when STREAM_SERVER_URL is set", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "pong" }), { status: 200 }));
    const env = { ...createMockEnv(), STREAM_SERVER_URL: "https://stream.example.run.app" };
    const res = await app.request("/api/v1/stream/heartbeat", { method: "POST" }, env);
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith("https://stream.example.run.app/ping", expect.objectContaining({ method: "GET" }));
    expect(mockStubFetch).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("pings the session's stream container otherwise", async () => {
    mockStubFetch.mockResolvedValue(new Response(JSON.stringify({ status: "pong" }), { status: 200 }));
    const env = createMockEnv();
    const res = await app.request("/api/v1/stream/heartbeat", { method: "POST", headers: { "x-stream-session-id": "rx-abc" } }, env);
    expect(res.status).toBe(200);
    const forwarded: Request = mockStubFetch.mock.calls[0]?.[0];
    expect(new URL(forwarded.url).pathname).toBe("/ping");
    expect(env.STREAM_CONTAINER.idFromName).toHaveBeenCalledWith("session-rx-abc");
  });

  it("passes 410 through when the stream hit its maximum lifetime (the receiver stops pinging)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "expired" }), { status: 410 }));
    const env = { ...createMockEnv(), STREAM_SERVER_URL: "https://stream.example.run.app" };
    const res = await app.request("/api/v1/stream/heartbeat", { method: "POST" }, env);
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ expired: true });
    fetchSpy.mockRestore();
  });

  it("reports the stream server being down as 502", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unreachable"));
    const env = { ...createMockEnv(), STREAM_SERVER_URL: "https://stream.example.run.app" };
    const res = await app.request("/api/v1/stream/heartbeat", { method: "POST" }, env);
    expect(res.status).toBe(502);
    fetchSpy.mockRestore();
  });
});
