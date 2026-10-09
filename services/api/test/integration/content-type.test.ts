import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { TEST_GAME_API_KEY } from "./helpers";

/**
 * Content-Type & Malformed Body Integration Tests
 *
 * Tests boundary validation at the Workers runtime level:
 * - Missing Content-Type header
 * - Wrong Content-Type header
 * - Malformed JSON bodies
 * - Empty request bodies
 */

const API_KEY = TEST_GAME_API_KEY;

function authHeaders(contentType?: string) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${API_KEY}`,
  };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

describe("Content-Type & Body Validation — Workers Runtime", () => {
  beforeEach(async () => {
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

  // Repointed 2026-10-07: /notifications/send was removed (ADR game push and app links).
  describe("Notification Send", () => {
    it("rejects malformed JSON body", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/games/codebreakers/notifications", {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "}{bad",
      });

      // Should get 400 for bad JSON (not 500)
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("rejects empty body", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/games/codebreakers/notifications", {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });
});
