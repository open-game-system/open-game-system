import { describe, it, expect, vi } from "vitest";
import app from "../src/index";

// Mock D1 database
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
  };
}

describe("Device registration", () => {
  it("POST /api/v1/devices/register returns 400 for invalid JSON", async () => {
    const res = await app.request("/api/v1/devices/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_body");
  });

  it("POST /api/v1/devices/register returns 400 for missing fields", async () => {
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
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("missing_fields");
  });

  it("POST /api/v1/devices/register returns 400 for invalid platform", async () => {
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
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_platform");
  });

  it("POST /api/v1/devices/register succeeds with valid input", async () => {
    const env = createMockEnv();
    const res = await app.request(
      "/api/v1/devices/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device-1",
          platform: "ios",
          pushToken: "token-abc",
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deviceId: string; registered: boolean };
    expect(body.deviceId).toBe("device-1");
    expect(body.registered).toBe(true);
  });
});
