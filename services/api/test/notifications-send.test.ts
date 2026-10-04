import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { signJwt } from "../src/lib/jwt";
import { openTestD1, type TestD1 } from "./support/d1";

/** POST /api/v1/notifications/send against a real local D1 and a stubbed Expo push API. */
const SECRET = "notifications-secret";
let d1: TestD1;
let expoTicket: Record<string, unknown>;

beforeAll(async () => {
  d1 = await openTestD1();
});
afterAll(() => d1.dispose());
beforeEach(async () => {
  await d1.reset();
  await d1.db.batch([
    d1.db.prepare(
      "INSERT INTO api_keys (key, game_id, game_name) VALUES ('k1', 'trivia', 'Trivia')",
    ),
    d1.db.prepare(
      "INSERT INTO devices (ogs_device_id, platform, push_token) VALUES ('d1', 'ios', 'ExponentPushToken[d1]')",
    ),
  ]);
  expoTicket = { status: "ok", id: "ticket-1" };
  vi.stubGlobal("fetch", async () => Response.json({ data: [expoTicket] }));
});
afterEach(() => vi.unstubAllGlobals());

const deviceToken = (payload: Record<string, unknown> = { sub: "d1", iat: 1, iss: "ogs-api" }) =>
  signJwt(payload, SECRET);

async function send(token: string) {
  const res = await app.request(
    "/api/v1/notifications/send",
    {
      method: "POST",
      headers: { Authorization: "Bearer k1", "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceToken: token,
        notification: { title: "Your turn", body: "Go" },
      }),
    },
    { DB: d1.db, OGS_JWT_SECRET: SECRET },
  );
  return { status: res.status, body: await res.json() };
}
const deviceCount = async () =>
  (await d1.db.prepare("SELECT COUNT(*) AS n FROM devices").first())?.n;

describe("notifications send", () => {
  it("sends and answers an id", async () => {
    const r = await send(await deviceToken());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "sent", deviceActive: true, id: expect.any(String) });
  });

  it("refuses a signed token whose payload isn't a device token", async () => {
    const r = await send(await deviceToken({ sub: "d1", iat: 1, iss: "someone-else" }));
    expect(r).toEqual({
      status: 401,
      body: {
        error: {
          code: "invalid_device_token",
          message: "Device token payload is malformed",
          status: 401,
        },
      },
    });
  });

  it("keeps the device when Expo fails for another reason", async () => {
    expoTicket = {
      status: "error",
      message: "Rate limited",
      details: { error: "MessageRateExceeded" },
    };
    const r = await send(await deviceToken());
    expect(r).toEqual({
      status: 502,
      body: {
        error: { code: "push_failed", message: "MessageRateExceeded", status: 502 },
        deviceActive: true,
      },
    });
    expect(await deviceCount()).toBe(1);
  });

  it("forgets the device when Expo says it is gone", async () => {
    expoTicket = { status: "error", details: { error: "DeviceNotRegistered" } };
    const r = await send(await deviceToken());
    expect(r.body).toMatchObject({ deviceActive: false });
    expect(await deviceCount()).toBe(0);
  });
});
