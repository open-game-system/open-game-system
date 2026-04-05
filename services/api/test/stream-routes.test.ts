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
