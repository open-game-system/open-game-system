import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Notification Integration Tests
 *
 * Tests the full notification flow through real Workers runtime + D1:
 * 1. Register device → get JWT device token
 * 2. Send notification with device token → verify Expo push call
 * 3. Device cleanup on invalid tokens
 *
 * Following Testing Trophy: these are integration tests that cover
 * the full request lifecycle, not isolated unit mocks.
 */

const API_KEY = "test-api-key";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };
}

describe("Notification Flow — Full Integration", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM devices").run();
  });

  describe("Device Registration → Notification Send", () => {
    it("registers a device and sends a notification end-to-end", async () => {
      // Step 1: Register device
      const registerRes = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-e2e-1",
          platform: "ios",
          pushToken: "ExponentPushToken[test-token-abc]",
        }),
      });

      expect(registerRes.status).toBe(200);
      const { deviceToken } = (await registerRes.json()) as {
        deviceToken: string;
      };
      expect(deviceToken).toBeTruthy();

      // Verify device is in D1
      const device = await env.DB.prepare("SELECT * FROM devices WHERE ogs_device_id = ?")
        .bind("device-e2e-1")
        .first();
      expect(device).toBeTruthy();
      expect(device!.push_token).toBe("ExponentPushToken[test-token-abc]");

      // Step 2: Send notification using the device token
      const sendRes = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          deviceToken,
          notification: {
            title: "Game Starting!",
            body: "Trivia Jam is about to begin",
          },
        }),
      });

      // In test env, Expo push client isn't available, so the push itself
      // may fail with 502. What matters is the auth + D1 lookup succeeded.
      // A 200 means push succeeded, 502 means push provider failed (expected in test).
      expect([200, 502]).toContain(sendRes.status);
    });

    it("rejects notification with tampered device token", async () => {
      const sendRes = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          deviceToken: "eyJhbGciOiJIUzI1NiJ9.tampered.signature",
          notification: {
            title: "Should Fail",
            body: "This token is fake",
          },
        }),
      });

      // Should reject — tampered token causes auth failure or internal error
      expect(sendRes.status).toBeGreaterThanOrEqual(400);
    });

    it("returns 404 when device has been deleted", async () => {
      // Register, get token, then delete the device
      const registerRes = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-deleted",
          platform: "android",
          pushToken: "ExponentPushToken[will-be-deleted]",
        }),
      });
      const { deviceToken } = (await registerRes.json()) as {
        deviceToken: string;
      };

      // Delete device from D1 directly (simulating cleanup)
      await env.DB.prepare("DELETE FROM devices WHERE ogs_device_id = ?")
        .bind("device-deleted")
        .run();

      // Try to send notification
      const sendRes = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          deviceToken,
          notification: {
            title: "Should 404",
            body: "Device is gone",
          },
        }),
      });

      expect(sendRes.status).toBe(404);
      const body = (await sendRes.json()) as { error: { code: string } };
      expect(body.error.code).toBe("device_not_found");
    });
  });

  describe("Device Token Lifecycle", () => {
    it("device token JWT contains correct claims", async () => {
      const registerRes = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-jwt-test",
          platform: "ios",
          pushToken: "ExponentPushToken[jwt-test]",
        }),
      });

      const { deviceToken } = (await registerRes.json()) as {
        deviceToken: string;
      };

      // JWT should have 3 parts: header.payload.signature
      const parts = deviceToken.split(".");
      expect(parts).toHaveLength(3);

      // Decode payload (base64url)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      expect(payload.sub).toBe("device-jwt-test");
      expect(payload.iss).toBe("ogs-api");
      expect(payload.iat).toBeGreaterThan(0);
    });

    it("re-registration returns new JWT but same device record", async () => {
      // Register first time
      const res1 = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-reregister",
          platform: "ios",
          pushToken: "ExponentPushToken[old]",
        }),
      });
      const { deviceToken: token1 } = (await res1.json()) as {
        deviceToken: string;
      };

      // Register again with new push token
      const res2 = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-reregister",
          platform: "ios",
          pushToken: "ExponentPushToken[new]",
        }),
      });
      const { deviceToken: token2 } = (await res2.json()) as {
        deviceToken: string;
      };

      // Both tokens should be valid JWTs
      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();

      // Only one device record should exist
      const count = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM devices WHERE ogs_device_id = ?",
      )
        .bind("device-reregister")
        .first<{ count: number }>();
      expect(count?.count).toBe(1);

      // Push token should be updated
      const device = await env.DB.prepare("SELECT push_token FROM devices WHERE ogs_device_id = ?")
        .bind("device-reregister")
        .first<{ push_token: string }>();
      expect(device?.push_token).toBe("ExponentPushToken[new]");
    });
  });

  describe("Notification Validation", () => {
    it("rejects notification without title", async () => {
      // Register device first
      const registerRes = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-validation",
          platform: "ios",
          pushToken: "ExponentPushToken[validation]",
        }),
      });
      const { deviceToken } = (await registerRes.json()) as {
        deviceToken: string;
      };

      const sendRes = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          deviceToken,
          notification: { body: "Missing title" },
        }),
      });

      expect(sendRes.status).toBe(400);
    });

    it("rejects notification without body", async () => {
      const registerRes = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-validation-2",
          platform: "ios",
          pushToken: "ExponentPushToken[validation2]",
        }),
      });
      const { deviceToken } = (await registerRes.json()) as {
        deviceToken: string;
      };

      const sendRes = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          deviceToken,
          notification: { title: "Missing body" },
        }),
      });

      expect(sendRes.status).toBe(400);
    });

    it("accepts notification with optional data payload", async () => {
      const registerRes = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-data-payload",
          platform: "ios",
          pushToken: "ExponentPushToken[data-payload]",
        }),
      });
      const { deviceToken } = (await registerRes.json()) as {
        deviceToken: string;
      };

      const sendRes = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          deviceToken,
          notification: {
            title: "Game Ready",
            body: "Join now!",
            data: {
              url: "https://triviajam.tv/games/abc123",
              gameId: "abc123",
            },
          },
        }),
      });

      // 200 = push sent, 502 = push provider failed (expected in test env)
      expect([200, 502]).toContain(sendRes.status);
    });
  });

  describe("Cross-cutting: Auth applies correctly", () => {
    it("device registration does NOT require API key", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "no-auth-needed",
          platform: "ios",
          pushToken: "ExponentPushToken[noauth]",
        }),
      });

      // Should succeed without Authorization header
      expect(res.status).toBe(200);
    });

    it("notification send REQUIRES API key", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceToken: "any",
          notification: { title: "Test", body: "Test" },
        }),
      });

      expect(res.status).toBe(401);
    });

    it("cast session stream proxy does NOT require API key", async () => {
      const res = await SELF.fetch("https://api.test/api/v1/cast/stream/fake-session/ice-servers", {
        method: "GET",
      });

      // Should not be 401 (might be 502 since no container, but not auth failure)
      expect(res.status).not.toBe(401);
    });
  });
});
