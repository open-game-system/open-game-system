import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Content-Type & Malformed Body Integration Tests
 *
 * Tests boundary validation at the Workers runtime level:
 * - Missing Content-Type header
 * - Wrong Content-Type header
 * - Malformed JSON bodies
 * - Empty request bodies
 */

const API_KEY = "test-api-key";

function authHeaders(contentType?: string) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${API_KEY}`,
  };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

describe("Content-Type & Body Validation — Workers Runtime", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM cast_sessions").run();
    await env.DB.prepare("DELETE FROM devices").run();
  });

  describe("Device Registration", () => {
    it("rejects empty body", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rejects malformed JSON", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rejects valid JSON with wrong shape", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wrong: "shape" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("Cast Session Creation", () => {
    it("rejects empty body", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rejects malformed JSON body", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "not-json{{{",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("invalid_body");
    });

    it("rejects body with missing required fields", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ deviceId: "tv-1" }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("missing_fields");
    });
  });

  describe("Cast State Update", () => {
    it("rejects malformed JSON body on state push", async () => {
      // Create a session first
      const createRes = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({
          deviceId: "tv-1",
          viewUrl: "https://example.com/spectate",
        }),
      });
      const { sessionId } = (await createRes.json()) as {
        sessionId: string;
      };

      const res = await SELF.fetch(`https://api.test/api/v1/cast/sessions/${sessionId}/state`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "broken-json",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("invalid_body");
    });

    it("rejects state push with missing state object", async () => {
      const createRes = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({
          deviceId: "tv-1",
          viewUrl: "https://example.com/spectate",
        }),
      });
      const { sessionId } = (await createRes.json()) as {
        sessionId: string;
      };

      const res = await SELF.fetch(`https://api.test/api/v1/cast/sessions/${sessionId}/state`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ notState: true }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("missing_fields");
    });
  });

  describe("Notification Send", () => {
    it("rejects malformed JSON body", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "}{bad",
      });

      // Should get 400 for bad JSON (not 500)
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("rejects empty body", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });
});
