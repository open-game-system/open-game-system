import { describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { OgsErrorSchema, RegisterDeviceResponseSchema } from "../src/schemas";

const JWT_SECRET = "test-jwt-secret";

function createMockEnv() {
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn().mockResolvedValue({}),
          first: vi.fn().mockResolvedValue(null),
        })),
      })),
    },
    OGS_JWT_SECRET: JWT_SECRET,
  };
}

describe("Device registration", () => {
  it("rejects invalid JSON", async () => {
    const res = await app.request("/api/v1/devices/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("invalid_body");
  });

  it("rejects missing fields", async () => {
    const env = createMockEnv();
    const res = await app.request(
      "/api/v1/devices/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ogsDeviceId: "test" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("missing_fields");
  });

  it("rejects invalid platform", async () => {
    const env = createMockEnv();
    const res = await app.request(
      "/api/v1/devices/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-1",
          platform: "windows",
          pushToken: "token-abc",
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("invalid_platform");
  });

  // Changed 2026-10-07 (ADR game push and app links, decision 9): registration no longer issues a
  // device token for games; it only records how OGS reaches the app.
  it("returns deviceId and registered, and no device token", async () => {
    const env = createMockEnv();
    const res = await app.request(
      "/api/v1/devices/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-1",
          platform: "ios",
          pushToken: "ExponentPushToken[abc123]",
        }),
      },
      env,
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    const body = RegisterDeviceResponseSchema.parse(json);
    expect(body.deviceId).toBe("device-1");
    expect(body.registered).toBe(true);
    expect(json).not.toHaveProperty("deviceToken");
  });
});
