import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/index";
import { OgsErrorSchema, SendNotificationResponseSchema, PushFailedResponseSchema } from "../src/schemas";
import { signJwt } from "../src/lib/jwt";

const JWT_SECRET = "test-jwt-secret";

// Mock fetch for Expo Push API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: [{ status: "ok", id: "expo-receipt-test" }] }),
  });
});

function createMockEnv(apiKeyResult: unknown = null, deviceResult: unknown = null) {
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
        if (sql.includes("DELETE")) {
          return {
            bind: vi.fn(() => ({
              run: vi.fn().mockResolvedValue({}),
            })),
          };
        }
        if (sql.includes("devices")) {
          return {
            bind: vi.fn(() => ({
              first: vi.fn().mockResolvedValue(deviceResult),
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
    OGS_JWT_SECRET: JWT_SECRET,
  };
}

async function makeDeviceToken(deviceId: string): Promise<string> {
  return signJwt({ sub: deviceId, iat: Math.floor(Date.now() / 1000), iss: "ogs-api" }, JWT_SECRET);
}

describe("Notifications endpoint", () => {
  // Auth tests
  it("returns 401 without auth", async () => {
    const env = createMockEnv();
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceToken: "some-token",
          notification: { title: "Test", body: "Hello" },
        }),
      },
      env,
    );
    expect(res.status).toBe(401);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("missing_auth");
  });

  it("returns 401 for invalid API key", async () => {
    const env = createMockEnv(null);
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-key",
        },
        body: JSON.stringify({
          deviceToken: "some-token",
          notification: { title: "Test", body: "Hello" },
        }),
      },
      env,
    );
    expect(res.status).toBe(401);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("invalid_api_key");
  });

  // Validation tests
  it("returns 400 for missing notification fields", async () => {
    const env = createMockEnv({ key: "valid-key", game_id: "game-1", game_name: "Test Game" });
    const deviceToken = await makeDeviceToken("device-1");
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({ deviceToken }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("missing_fields");
  });

  it("returns 400 for missing deviceToken", async () => {
    const env = createMockEnv({ key: "valid-key", game_id: "game-1", game_name: "Test Game" });
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({ notification: { title: "Test", body: "Hello" } }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("missing_fields");
  });

  // JWT validation
  it("returns 401 for tampered device token", async () => {
    const env = createMockEnv({ key: "valid-key", game_id: "game-1", game_name: "Test Game" });
    const validToken = await makeDeviceToken("device-1");
    const tamperedToken = validToken.slice(0, -5) + "XXXXX";

    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({
          deviceToken: tamperedToken,
          notification: { title: "Test", body: "Hello" },
        }),
      },
      env,
    );
    expect(res.status).toBe(401);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("invalid_device_token");
  });

  it("returns 401 for malformed device token (not a JWT)", async () => {
    const env = createMockEnv({ key: "valid-key", game_id: "game-1", game_name: "Test Game" });
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({
          deviceToken: "not-a-jwt",
          notification: { title: "Test", body: "Hello" },
        }),
      },
      env,
    );
    expect(res.status).toBe(401);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("invalid_device_token");
  });

  // Device lookup
  it("returns 404 when device from JWT not found", async () => {
    const env = createMockEnv(
      { key: "valid-key", game_id: "game-1", game_name: "Test Game" },
      null, // device not found
    );
    const deviceToken = await makeDeviceToken("device-deleted");
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({
          deviceToken,
          notification: { title: "Test", body: "Hello" },
        }),
      },
      env,
    );
    expect(res.status).toBe(404);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("device_not_found");
  });

  // Successful delivery
  it("sends notification successfully with valid device token", async () => {
    const env = createMockEnv(
      { key: "valid-key", game_id: "game-1", game_name: "Test Game" },
      { ogs_device_id: "device-1", platform: "ios", push_token: "ExponentPushToken[abc]" },
    );
    const deviceToken = await makeDeviceToken("device-1");
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({
          deviceToken,
          notification: { title: "Your turn!", body: "Alex just played" },
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = SendNotificationResponseSchema.parse(await res.json());
    expect(body.status).toBe("sent");
    expect(body.deviceActive).toBe(true);

    // Verify Expo received the right push token
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchBody.to).toBe("ExponentPushToken[abc]");
    expect(fetchBody.title).toBe("Your turn!");
  });

  // Push failure with device cleanup
  it("cleans up device on DeviceNotRegistered and returns deviceActive false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [{ status: "error", message: "DeviceNotRegistered", details: { error: "DeviceNotRegistered" } }],
      }),
    });

    const env = createMockEnv(
      { key: "valid-key", game_id: "game-1", game_name: "Test Game" },
      { ogs_device_id: "device-1", platform: "ios", push_token: "ExponentPushToken[old]" },
    );
    const deviceToken = await makeDeviceToken("device-1");
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({
          deviceToken,
          notification: { title: "Test", body: "Test" },
        }),
      },
      env,
    );
    expect(res.status).toBe(502);
    const body = PushFailedResponseSchema.parse(await res.json());
    expect(body.deviceActive).toBe(false);

    // Verify DELETE was called
    const deleteCalls = (env.DB.prepare as ReturnType<typeof vi.fn>).mock.calls
      .filter(([sql]: [string]) => sql.includes("DELETE"));
    expect(deleteCalls.length).toBe(1);
  });
});
