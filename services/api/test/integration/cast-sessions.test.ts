import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";

const API_KEY = "test-api-key";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

describe("Cast Sessions — D1 Integration", () => {
  beforeEach(async () => {
    // Clean cast_sessions table between tests
    await env.DB.prepare("DELETE FROM cast_sessions").run();
  });

  describe("POST /api/v1/cast/sessions", () => {
    it("creates a session and persists it in D1", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          deviceId: "living-room-tv",
          viewUrl: "https://triviajam.tv/spectate/abc123",
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        sessionId: string;
        streamSessionId: string;
        streamUrl: string;
        status: string;
      };
      expect(body.status).toBe("active");
      expect(body.sessionId).toBeTruthy();

      // Verify it's in D1
      const row = await env.DB.prepare(
        "SELECT * FROM cast_sessions WHERE session_id = ?"
      )
        .bind(body.sessionId)
        .first();

      expect(row).toBeTruthy();
      expect(row!.device_id).toBe("living-room-tv");
      expect(row!.view_url).toBe("https://triviajam.tv/spectate/abc123");
      expect(row!.status).toBe("active");
      expect(row!.game_id).toBe("trivia-jam");
    });

    it("rejects non-HTTPS viewUrl", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          deviceId: "tv-1",
          viewUrl: "http://insecure.example.com",
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("invalid_view_url");
    });

    it("rejects missing fields", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({ deviceId: "tv-1" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/cast/sessions/:id", () => {
    it("returns session details from D1", async () => {
      // Create a session first
      const createRes = await SELF.fetch(
        "https://api.test/api/v1/cast/sessions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            deviceId: "tv-1",
            viewUrl: "https://triviajam.tv/spectate/xyz",
          }),
        }
      );
      const { sessionId } = (await createRes.json()) as { sessionId: string };

      // Get it
      const res = await SELF.fetch(
        `https://api.test/api/v1/cast/sessions/${sessionId}`,
        { headers }
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { sessionId: string; status: string };
      expect(body.sessionId).toBe(sessionId);
      expect(body.status).toBe("active");
    });

    it("returns 404 for non-existent session", async () => {
      const res = await SELF.fetch(
        "https://api.test/api/v1/cast/sessions/non-existent-id",
        { headers }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/cast/sessions/:id", () => {
    it("marks session as ended in D1", async () => {
      // Create a session
      const createRes = await SELF.fetch(
        "https://api.test/api/v1/cast/sessions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            deviceId: "tv-1",
            viewUrl: "https://triviajam.tv/spectate/xyz",
          }),
        }
      );
      const { sessionId } = (await createRes.json()) as { sessionId: string };

      // Delete it
      const res = await SELF.fetch(
        `https://api.test/api/v1/cast/sessions/${sessionId}`,
        { method: "DELETE", headers }
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe("ended");

      // Verify in D1
      const row = await env.DB.prepare(
        "SELECT status FROM cast_sessions WHERE session_id = ?"
      )
        .bind(sessionId)
        .first<{ status: string }>();

      expect(row?.status).toBe("ended");
    });

    it("delete is idempotent", async () => {
      // Create and delete
      const createRes = await SELF.fetch(
        "https://api.test/api/v1/cast/sessions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            deviceId: "tv-1",
            viewUrl: "https://triviajam.tv/spectate/xyz",
          }),
        }
      );
      const { sessionId } = (await createRes.json()) as { sessionId: string };

      // Delete twice
      await SELF.fetch(
        `https://api.test/api/v1/cast/sessions/${sessionId}`,
        { method: "DELETE", headers }
      );
      const res = await SELF.fetch(
        `https://api.test/api/v1/cast/sessions/${sessionId}`,
        { method: "DELETE", headers }
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe("ended");
    });
  });

  describe("Auth — real D1 API key lookup", () => {
    it("rejects request without auth header", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "tv-1",
          viewUrl: "https://example.com",
        }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects invalid API key against real D1", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer fake-key-not-in-db",
        },
        body: JSON.stringify({
          deviceId: "tv-1",
          viewUrl: "https://example.com",
        }),
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("invalid_api_key");
    });
  });
});
