import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/index";

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
  };
}

describe("Notifications endpoint", () => {
  it("POST /api/v1/notifications/send returns 401 without auth", async () => {
    const env = createMockEnv();
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "device-1",
          notification: { title: "Test", body: "Hello" },
        }),
      },
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("missing_auth");
  });

  it("POST /api/v1/notifications/send returns 401 for invalid API key", async () => {
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
          deviceId: "device-1",
          notification: { title: "Test", body: "Hello" },
        }),
      },
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_api_key");
  });

  it("POST /api/v1/notifications/send returns 400 for missing fields", async () => {
    const env = createMockEnv({ key: "valid-key", game_id: "game-1", game_name: "Test Game" });
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({ deviceId: "device-1" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("missing_fields");
  });

  it("POST /api/v1/notifications/send returns 404 for unknown device", async () => {
    const env = createMockEnv(
      { key: "valid-key", game_id: "game-1", game_name: "Test Game" },
      null,
    );
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({
          deviceId: "device-1",
          notification: { title: "Test", body: "Hello" },
        }),
      },
      env,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("device_not_found");
  });

  it("POST /api/v1/notifications/send succeeds with valid input", async () => {
    const env = createMockEnv(
      { key: "valid-key", game_id: "game-1", game_name: "Test Game" },
      { ogs_device_id: "device-1", platform: "ios", push_token: "token-abc" },
    );
    const res = await app.request(
      "/api/v1/notifications/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({
          deviceId: "device-1",
          notification: { title: "Test", body: "Hello" },
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; id: string };
    expect(body.status).toBe("sent");
    expect(body.id).toBeDefined();
  });
});
