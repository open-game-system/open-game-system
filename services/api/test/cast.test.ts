import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/index";
import {
  OgsErrorSchema,
  CreateCastSessionResponseSchema,
  CastSessionStatusResponseSchema,
  CastSessionEndedResponseSchema,
} from "../src/schemas";

const VALID_API_KEY = { key: "valid-key", game_id: "trivia-jam", game_name: "Trivia Jam" };

// Mock DO stub for StreamContainer
const mockStubFetch = vi.fn();

function createMockStreamContainer() {
  return {
    idFromName: vi.fn(() => ({ toString: () => "mock-do-id" })),
    get: vi.fn(() => ({
      fetch: mockStubFetch,
    })),
  };
}

beforeEach(() => {
  mockStubFetch.mockReset();
});

function createMockEnv(opts: {
  apiKeyResult?: unknown;
  castSessionResult?: unknown;
  insertSuccess?: boolean;
} = {}) {
  const { apiKeyResult = null, castSessionResult = null, insertSuccess = true } = opts;

  return {
    DB: {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("api_keys")) {
          return {
            bind: vi.fn(() => ({
              first: vi.fn().mockResolvedValue(apiKeyResult),
            })),
          };
        }
        if (sql.includes("INSERT INTO cast_sessions")) {
          return {
            bind: vi.fn(() => ({
              run: vi.fn().mockResolvedValue(insertSuccess ? { success: true } : { success: false }),
            })),
          };
        }
        if (sql.includes("UPDATE cast_sessions")) {
          return {
            bind: vi.fn(() => ({
              run: vi.fn().mockResolvedValue({ success: true }),
            })),
          };
        }
        if (sql.includes("DELETE") || sql.includes("delete")) {
          return {
            bind: vi.fn(() => ({
              run: vi.fn().mockResolvedValue({ success: true }),
            })),
          };
        }
        if (sql.includes("cast_sessions")) {
          return {
            bind: vi.fn(() => ({
              first: vi.fn().mockResolvedValue(castSessionResult),
            })),
          };
        }
        return {
          bind: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({}),
          })),
        };
      }),
    },
    OGS_JWT_SECRET: "test-jwt-secret",
    STREAM_CONTAINER: createMockStreamContainer(),
    CLOUDFLARE_TURN_API_TOKEN: "test-turn-token",
    CLOUDFLARE_TURN_KEY_ID: "test-turn-key-id",
  };
}

function authHeaders(apiKey = "valid-key") {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

describe("Cast Sessions API", () => {
  // ─── Auth ───

  describe("POST /api/v1/cast/sessions - Auth", () => {
    it("returns 401 without Authorization header", async () => {
      const env = createMockEnv();
      const res = await app.request(
        "/api/v1/cast/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: "tv-1", viewUrl: "https://triviajam.com/tv" }),
        },
        env,
      );
      expect(res.status).toBe(401);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("missing_auth");
    });

    it("returns 401 for invalid API key", async () => {
      const env = createMockEnv({ apiKeyResult: null });
      const res = await app.request(
        "/api/v1/cast/sessions",
        {
          method: "POST",
          headers: authHeaders("bad-key"),
          body: JSON.stringify({ deviceId: "tv-1", viewUrl: "https://triviajam.com/tv" }),
        },
        env,
      );
      expect(res.status).toBe(401);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("invalid_api_key");
    });
  });

  // ─── Create Session ───

  describe("POST /api/v1/cast/sessions - Validation", () => {
    it("returns 400 for missing deviceId", async () => {
      const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
      const res = await app.request(
        "/api/v1/cast/sessions",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ viewUrl: "https://triviajam.com/tv" }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("missing_fields");
    });

    it("returns 400 for missing viewUrl", async () => {
      const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
      const res = await app.request(
        "/api/v1/cast/sessions",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ deviceId: "tv-1" }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("missing_fields");
    });

    it("returns 400 for non-HTTPS viewUrl", async () => {
      const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
      const res = await app.request(
        "/api/v1/cast/sessions",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ deviceId: "tv-1", viewUrl: "http://triviajam.com/tv" }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("invalid_view_url");
    });

    it("returns 400 for invalid JSON body", async () => {
      const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
      const res = await app.request(
        "/api/v1/cast/sessions",
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: "not json",
        },
        env,
      );
      expect(res.status).toBe(400);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("invalid_body");
    });
  });

  describe("POST /api/v1/cast/sessions - Success", () => {
    it("creates a cast session and provisions a stream via DO", async () => {
      mockStubFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({
          sessionId: "stream-456",
          streamUrl: "wss://stream.test.com/456",
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );

      const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
      const res = await app.request(
        "/api/v1/cast/sessions",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            deviceId: "living-room-tv",
            viewUrl: "https://triviajam.com/tv?code=ABCD",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
      const body = CreateCastSessionResponseSchema.parse(await res.json());
      expect(body.status).toBe("active");
      expect(body.streamSessionId).toBe("stream-456");
      expect(body.streamUrl).toBe("wss://stream.test.com/456");

      // Verify DO stub was called with the viewUrl
      expect(mockStubFetch).toHaveBeenCalledOnce();
      const calledRequest = mockStubFetch.mock.calls[0][0] as Request;
      expect(calledRequest.url).toContain("/start-stream");
      const fetchBody = await calledRequest.clone().json() as { url: string };
      expect(fetchBody.url).toBe("https://triviajam.com/tv?code=ABCD");
    });

    it("returns 502 when stream provisioning fails", async () => {
      mockStubFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "container failed to start" }), { status: 500 }),
      );

      const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
      const res = await app.request(
        "/api/v1/cast/sessions",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            deviceId: "tv-1",
            viewUrl: "https://triviajam.com/tv?code=ABCD",
          }),
        },
        env,
      );
      expect(res.status).toBe(502);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("stream_provisioning_failed");
    });
  });

  // ─── Get Session ───

  describe("GET /api/v1/cast/sessions/:id", () => {
    it("returns session status for active session", async () => {
      const env = createMockEnv({
        apiKeyResult: VALID_API_KEY,
        castSessionResult: {
          session_id: "session-123",
          game_id: "trivia-jam",
          device_id: "tv-1",
          view_url: "https://triviajam.com/tv",
          stream_session_id: "stream-456",
          stream_url: "wss://stream.test.com/456",
          status: "active",
          created_at: "2026-03-14T00:00:00",
          updated_at: "2026-03-14T00:00:00",
        },
      });
      const res = await app.request(
        "/api/v1/cast/sessions/session-123",
        { method: "GET", headers: authHeaders() },
        env,
      );
      expect(res.status).toBe(200);
      const body = CastSessionStatusResponseSchema.parse(await res.json());
      expect(body.sessionId).toBe("session-123");
      expect(body.status).toBe("active");
      expect(body.streamUrl).toBe("wss://stream.test.com/456");
    });

    it("returns 404 for nonexistent session", async () => {
      const env = createMockEnv({ apiKeyResult: VALID_API_KEY, castSessionResult: null });
      const res = await app.request(
        "/api/v1/cast/sessions/does-not-exist",
        { method: "GET", headers: authHeaders() },
        env,
      );
      expect(res.status).toBe(404);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("session_not_found");
    });

    it("returns 404 when session belongs to different game", async () => {
      const env = createMockEnv({
        apiKeyResult: VALID_API_KEY,
        castSessionResult: {
          session_id: "session-123",
          game_id: "other-game", // Different from VALID_API_KEY.game_id
          device_id: "tv-1",
          view_url: "https://other.com/tv",
          stream_session_id: null,
          stream_url: null,
          status: "active",
          created_at: "2026-03-14T00:00:00",
          updated_at: "2026-03-14T00:00:00",
        },
      });
      const res = await app.request(
        "/api/v1/cast/sessions/session-123",
        { method: "GET", headers: authHeaders() },
        env,
      );
      expect(res.status).toBe(404);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("session_not_found");
    });

    it("returns ended status for terminated session", async () => {
      const env = createMockEnv({
        apiKeyResult: VALID_API_KEY,
        castSessionResult: {
          session_id: "session-123",
          game_id: "trivia-jam",
          device_id: "tv-1",
          view_url: "https://triviajam.com/tv",
          stream_session_id: null,
          stream_url: null,
          status: "ended",
          created_at: "2026-03-14T00:00:00",
          updated_at: "2026-03-14T00:00:00",
        },
      });
      const res = await app.request(
        "/api/v1/cast/sessions/session-123",
        { method: "GET", headers: authHeaders() },
        env,
      );
      expect(res.status).toBe(200);
      const body = CastSessionStatusResponseSchema.parse(await res.json());
      expect(body.status).toBe("ended");
    });

    it("returns 401 without auth", async () => {
      const env = createMockEnv();
      const res = await app.request(
        "/api/v1/cast/sessions/session-123",
        { method: "GET" },
        env,
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── Push State Update ───

  describe("POST /api/v1/cast/sessions/:id/state", () => {
    it("pushes state update to active session via DO", async () => {
      mockStubFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      );

      const env = createMockEnv({
        apiKeyResult: VALID_API_KEY,
        castSessionResult: {
          session_id: "session-123",
          game_id: "trivia-jam",
          device_id: "tv-1",
          view_url: "https://triviajam.com/tv",
          stream_session_id: "stream-456",
          stream_url: "wss://stream.test.com/456",
          status: "active",
          created_at: "2026-03-14T00:00:00",
          updated_at: "2026-03-14T00:00:00",
        },
      });

      const res = await app.request(
        "/api/v1/cast/sessions/session-123/state",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            state: { question: "What year was JS created?", round: 3, timer: 30 },
          }),
        },
        env,
      );
      expect(res.status).toBe(200);

      // Verify the state was forwarded to DO
      expect(mockStubFetch).toHaveBeenCalledOnce();
      const calledRequest = mockStubFetch.mock.calls[0][0] as Request;
      expect(calledRequest.url).toContain("stream-456");
      const fetchBody = await calledRequest.clone().json() as { state: { question: string } };
      expect(fetchBody.state.question).toBe("What year was JS created?");
    });

    it("returns 404 for ended session", async () => {
      const env = createMockEnv({
        apiKeyResult: VALID_API_KEY,
        castSessionResult: {
          session_id: "session-123",
          game_id: "trivia-jam",
          status: "ended",
        },
      });

      const res = await app.request(
        "/api/v1/cast/sessions/session-123/state",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ state: { round: 1 } }),
        },
        env,
      );
      expect(res.status).toBe(404);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("session_not_found");
    });

    it("returns 401 without auth", async () => {
      const env = createMockEnv();
      const res = await app.request(
        "/api/v1/cast/sessions/session-123/state",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: { round: 1 } }),
        },
        env,
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 for empty body", async () => {
      const env = createMockEnv({
        apiKeyResult: VALID_API_KEY,
        castSessionResult: {
          session_id: "session-123",
          game_id: "trivia-jam",
          status: "active",
          stream_session_id: "stream-456",
        },
      });

      const res = await app.request(
        "/api/v1/cast/sessions/session-123/state",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(400);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("missing_fields");
    });
  });

  // ─── Delete Session ───

  describe("DELETE /api/v1/cast/sessions/:id", () => {
    it("ends an active session and tears down stream via DO", async () => {
      mockStubFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "stopped" }), { status: 200 }),
      );

      const env = createMockEnv({
        apiKeyResult: VALID_API_KEY,
        castSessionResult: {
          session_id: "session-123",
          game_id: "trivia-jam",
          device_id: "tv-1",
          view_url: "https://triviajam.com/tv",
          stream_session_id: "stream-456",
          stream_url: "wss://stream.test.com/456",
          status: "active",
          created_at: "2026-03-14T00:00:00",
          updated_at: "2026-03-14T00:00:00",
        },
      });

      const res = await app.request(
        "/api/v1/cast/sessions/session-123",
        { method: "DELETE", headers: authHeaders() },
        env,
      );
      expect(res.status).toBe(200);
      const body = CastSessionEndedResponseSchema.parse(await res.json());
      expect(body.status).toBe("ended");

      // Verify DO teardown was called
      expect(mockStubFetch).toHaveBeenCalledOnce();
    });

    it("returns 200 for already-ended session (idempotent)", async () => {
      const env = createMockEnv({
        apiKeyResult: VALID_API_KEY,
        castSessionResult: {
          session_id: "session-123",
          game_id: "trivia-jam",
          status: "ended",
        },
      });

      const res = await app.request(
        "/api/v1/cast/sessions/session-123",
        { method: "DELETE", headers: authHeaders() },
        env,
      );
      expect(res.status).toBe(200);
      const body = CastSessionEndedResponseSchema.parse(await res.json());
      expect(body.status).toBe("ended");

      // No DO teardown needed for already-ended session
      expect(mockStubFetch).not.toHaveBeenCalled();
    });

    it("returns 404 for nonexistent session", async () => {
      const env = createMockEnv({ apiKeyResult: VALID_API_KEY, castSessionResult: null });
      const res = await app.request(
        "/api/v1/cast/sessions/does-not-exist",
        { method: "DELETE", headers: authHeaders() },
        env,
      );
      expect(res.status).toBe(404);
      const body = OgsErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("session_not_found");
    });

    it("returns 401 without auth", async () => {
      const env = createMockEnv();
      const res = await app.request(
        "/api/v1/cast/sessions/session-123",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── StreamContainer DO integration seam ───

  describe("StreamContainer DO integration seam", () => {
    const VIEW_URL = "https://triviajam.com/tv?code=ABCD";

    const activeSession = {
      session_id: "session-123",
      game_id: "trivia-jam",
      device_id: "tv-1",
      view_url: VIEW_URL,
      stream_session_id: "stream-456",
      stream_url: "wss://stream.test.com/456",
      status: "active",
      created_at: "2026-03-14T00:00:00",
      updated_at: "2026-03-14T00:00:00",
    };

    describe("POST /cast/sessions calls DO stub with correct URL and body", () => {
      it("sends POST to DO stub /start-stream with { url: viewUrl }", async () => {
        mockStubFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ sessionId: "stream-456", streamUrl: "wss://stream.test.com/456" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

        const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
        await app.request(
          "/api/v1/cast/sessions",
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ deviceId: "tv-1", viewUrl: VIEW_URL }),
          },
          env,
        );

        expect(mockStubFetch).toHaveBeenCalledOnce();
        const calledRequest = mockStubFetch.mock.calls[0][0] as Request;
        expect(calledRequest.url).toContain("/start-stream");
        expect(calledRequest.method).toBe("POST");
        expect(calledRequest.headers.get("Content-Type")).toBe("application/json");
        const reqBody = await calledRequest.clone().json();
        expect(reqBody).toEqual({ url: VIEW_URL });
      });
    });

    describe("POST /cast/sessions/:id/state forwards state correctly via DO", () => {
      it("sends POST to DO stub /sessions/${streamSessionId}/state with state body", async () => {
        const statePayload = { state: { question: "What year?", round: 3, timer: 30 } };

        mockStubFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
        );

        const env = createMockEnv({
          apiKeyResult: VALID_API_KEY,
          castSessionResult: activeSession,
        });

        await app.request(
          "/api/v1/cast/sessions/session-123/state",
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(statePayload),
          },
          env,
        );

        expect(mockStubFetch).toHaveBeenCalledOnce();
        const calledRequest = mockStubFetch.mock.calls[0][0] as Request;
        expect(calledRequest.url).toContain("/sessions/stream-456/state");
        expect(calledRequest.method).toBe("POST");
        expect(calledRequest.headers.get("Content-Type")).toBe("application/json");
        const reqBody = await calledRequest.clone().json();
        expect(reqBody).toEqual(statePayload);
      });
    });

    describe("DELETE /cast/sessions/:id tears down correctly via DO", () => {
      it("sends DELETE to DO stub /sessions/${streamSessionId}", async () => {
        mockStubFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ status: "stopped" }), { status: 200 }),
        );

        const env = createMockEnv({
          apiKeyResult: VALID_API_KEY,
          castSessionResult: activeSession,
        });

        await app.request(
          "/api/v1/cast/sessions/session-123",
          { method: "DELETE", headers: authHeaders() },
          env,
        );

        expect(mockStubFetch).toHaveBeenCalledOnce();
        const calledRequest = mockStubFetch.mock.calls[0][0] as Request;
        expect(calledRequest.url).toContain("/sessions/stream-456");
        expect(calledRequest.method).toBe("DELETE");
      });
    });

    describe("DO stub returns unexpected response shape", () => {
      it("returns 502 when sessionId is missing from DO response", async () => {
        mockStubFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ streamUrl: "wss://stream.test.com/456" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

        const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
        const res = await app.request(
          "/api/v1/cast/sessions",
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ deviceId: "tv-1", viewUrl: VIEW_URL }),
          },
          env,
        );

        expect(res.status).toBe(502);
        const body = OgsErrorSchema.parse(await res.json());
        expect(body.error.code).toBe("stream_provisioning_failed");
      });

      it("returns 502 when streamUrl is missing from DO response", async () => {
        mockStubFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ sessionId: "stream-456" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

        const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
        const res = await app.request(
          "/api/v1/cast/sessions",
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ deviceId: "tv-1", viewUrl: VIEW_URL }),
          },
          env,
        );

        expect(res.status).toBe(502);
        const body = OgsErrorSchema.parse(await res.json());
        expect(body.error.code).toBe("stream_provisioning_failed");
      });
    });

    describe("DO stub returns non-JSON response", () => {
      it("returns 502 when DO returns non-JSON", async () => {
        mockStubFetch.mockResolvedValueOnce(
          new Response("not json", { status: 200 }),
        );

        const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
        const res = await app.request(
          "/api/v1/cast/sessions",
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ deviceId: "tv-1", viewUrl: VIEW_URL }),
          },
          env,
        );

        expect(res.status).toBe(502);
        const body = OgsErrorSchema.parse(await res.json());
        expect(body.error.code).toBe("stream_provisioning_failed");
      });
    });

    describe("DO stub throws error", () => {
      it("returns 502 when DO stub fetch throws", async () => {
        mockStubFetch.mockRejectedValueOnce(new TypeError("DO fetch failed"));

        const env = createMockEnv({ apiKeyResult: VALID_API_KEY });
        const res = await app.request(
          "/api/v1/cast/sessions",
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ deviceId: "tv-1", viewUrl: VIEW_URL }),
          },
          env,
        );

        expect(res.status).toBe(502);
        const body = OgsErrorSchema.parse(await res.json());
        expect(body.error.code).toBe("stream_provisioning_failed");
      });
    });

    describe("state update forwarding fails silently", () => {
      it("returns 200 even when DO returns error on state push", async () => {
        mockStubFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "internal error" }), { status: 500 }),
        );

        const env = createMockEnv({
          apiKeyResult: VALID_API_KEY,
          castSessionResult: activeSession,
        });

        const res = await app.request(
          "/api/v1/cast/sessions/session-123/state",
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ state: { round: 3 } }),
          },
          env,
        );

        expect(res.status).toBe(200);
        const body = await res.json() as { status: string };
        expect(body.status).toBe("ok");
      });

      it("returns 200 even when DO stub fetch throws on state push", async () => {
        mockStubFetch.mockRejectedValueOnce(new TypeError("DO fetch failed"));

        const env = createMockEnv({
          apiKeyResult: VALID_API_KEY,
          castSessionResult: activeSession,
        });

        const res = await app.request(
          "/api/v1/cast/sessions/session-123/state",
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ state: { round: 3 } }),
          },
          env,
        );

        expect(res.status).toBe(200);
        const body = await res.json() as { status: string };
        expect(body.status).toBe("ok");
      });
    });
  });
});
