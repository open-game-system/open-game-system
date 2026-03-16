import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";

describe("Devices & Notifications — D1 Integration", () => {
  beforeEach(async () => {
    // Clean device table between tests
    await env.DB.prepare("DELETE FROM devices").run();
  });

  describe("POST /api/v1/devices/register", () => {
    it("registers a new device and persists in D1", async () => {
      const res = await SELF.fetch(
        "https://api.test/api/v1/devices/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ogsDeviceId: "device-abc123",
            platform: "ios",
            pushToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxx]",
          }),
        }
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { deviceToken: string };
      expect(body.deviceToken).toBeTruthy();

      // Verify in D1
      const row = await env.DB.prepare(
        "SELECT * FROM devices WHERE ogs_device_id = ?"
      )
        .bind("device-abc123")
        .first();

      expect(row).toBeTruthy();
      expect(row!.platform).toBe("ios");
      expect(row!.push_token).toBe(
        "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxx]"
      );
    });

    it("updates existing device push token on re-register", async () => {
      // Register first time
      await SELF.fetch("https://api.test/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-abc123",
          platform: "ios",
          pushToken: "ExponentPushToken[old-token]",
        }),
      });

      // Register again with new token
      const res = await SELF.fetch(
        "https://api.test/api/v1/devices/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ogsDeviceId: "device-abc123",
            platform: "ios",
            pushToken: "ExponentPushToken[new-token]",
          }),
        }
      );

      expect(res.status).toBe(200);

      // Verify the push token was updated
      const row = await env.DB.prepare(
        "SELECT push_token FROM devices WHERE ogs_device_id = ?"
      )
        .bind("device-abc123")
        .first<{ push_token: string }>();

      expect(row?.push_token).toBe("ExponentPushToken[new-token]");
    });

    it("rejects invalid platform", async () => {
      const res = await SELF.fetch(
        "https://api.test/api/v1/devices/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ogsDeviceId: "device-abc123",
            platform: "windows",
            pushToken: "ExponentPushToken[xxx]",
          }),
        }
      );

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/notifications/send", () => {
    it("rejects without auth", async () => {
      const res = await SELF.fetch(
        "https://api.test/api/v1/notifications/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceToken: "some-jwt",
            title: "Game starting!",
            body: "Join now",
          }),
        }
      );

      expect(res.status).toBe(401);
    });

    it("rejects with invalid API key", async () => {
      const res = await SELF.fetch(
        "https://api.test/api/v1/notifications/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer invalid-key",
          },
          body: JSON.stringify({
            deviceToken: "some-jwt",
            title: "Game starting!",
            body: "Join now",
          }),
        }
      );

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("invalid_api_key");
    });
  });

  describe("D1 schema integrity", () => {
    it("devices table has correct columns", async () => {
      const result = await env.DB.prepare(
        "PRAGMA table_info(devices)"
      ).all();

      const columns = result.results.map(
        (r: Record<string, unknown>) => r.name
      );
      expect(columns).toContain("ogs_device_id");
      expect(columns).toContain("platform");
      expect(columns).toContain("push_token");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");
    });

    it("api_keys table has correct columns", async () => {
      const result = await env.DB.prepare(
        "PRAGMA table_info(api_keys)"
      ).all();

      const columns = result.results.map(
        (r: Record<string, unknown>) => r.name
      );
      expect(columns).toContain("key");
      expect(columns).toContain("game_id");
      expect(columns).toContain("game_name");
    });

    it("cast_sessions table has correct columns", async () => {
      const result = await env.DB.prepare(
        "PRAGMA table_info(cast_sessions)"
      ).all();

      const columns = result.results.map(
        (r: Record<string, unknown>) => r.name
      );
      expect(columns).toContain("session_id");
      expect(columns).toContain("game_id");
      expect(columns).toContain("device_id");
      expect(columns).toContain("view_url");
      expect(columns).toContain("stream_session_id");
      expect(columns).toContain("stream_url");
      expect(columns).toContain("status");
    });

    it("test API key is seeded", async () => {
      const row = await env.DB.prepare(
        "SELECT * FROM api_keys WHERE key = ?"
      )
        .bind("test-api-key")
        .first();

      expect(row).toBeTruthy();
      expect(row!.game_id).toBe("trivia-jam");
    });
  });
});
