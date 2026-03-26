import { describe, expect, it, vi } from "vitest";
import app from "../src/index";
import {
  DeviceTokenPayloadSchema,
  OgsErrorSchema,
  RegisterDeviceResponseSchema,
} from "../src/schemas";

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

function decodeJwtPayload(jwt: string): unknown {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Not a JWT");
  return JSON.parse(atob(parts[1]));
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

  it("returns deviceId, registered, and a signed JWT deviceToken", async () => {
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

    const body = RegisterDeviceResponseSchema.parse(await res.json());
    expect(body.deviceId).toBe("device-1");
    expect(body.registered).toBe(true);

    // deviceToken must be a valid JWT with correct payload
    const payload = DeviceTokenPayloadSchema.parse(decodeJwtPayload(body.deviceToken));
    expect(payload.sub).toBe("device-1");
    expect(payload.iss).toBe("ogs-api");
    expect(payload.iat).toBeTypeOf("number");
  });
});
