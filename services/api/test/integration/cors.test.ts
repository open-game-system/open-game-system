import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/**
 * CORS Integration Tests
 *
 * Verifies that the global CORS middleware works correctly through the
 * real Workers runtime. Tests preflight (OPTIONS) and actual requests
 * with Origin headers.
 */
describe("CORS — Workers Runtime", () => {
  describe("Preflight (OPTIONS)", () => {
    it("returns CORS headers for OPTIONS request", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/health", {
        method: "OPTIONS",
        headers: {
          Origin: "https://triviajam.tv",
          "Access-Control-Request-Method": "GET",
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Access-Control-Allow-Methods")).toBeTruthy();
    });

    it("allows POST method in preflight for authenticated endpoints", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "OPTIONS",
        headers: {
          Origin: "https://triviajam.tv",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("allows DELETE method in preflight for cast sessions", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/cast/sessions/some-id", {
        method: "OPTIONS",
        headers: {
          Origin: "https://triviajam.tv",
          "Access-Control-Request-Method": "DELETE",
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("Actual requests include CORS headers", () => {
    it("health endpoint returns CORS headers on GET", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/health", {
        method: "GET",
        headers: {
          Origin: "https://triviajam.tv",
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("device registration returns CORS headers on POST", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: {
          Origin: "https://triviajam.tv",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ogsDeviceId: "cors-test-device",
          platform: "ios",
          pushToken: "ExponentPushToken[cors-test]",
        }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("error responses also include CORS headers", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "POST",
        headers: {
          Origin: "https://triviajam.tv",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invalid: true }),
      });

      // 401 because no auth — but should still have CORS headers
      expect(res.status).toBe(401);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });
});
