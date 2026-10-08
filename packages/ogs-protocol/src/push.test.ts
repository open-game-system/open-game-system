import { describe, expect, it } from "vitest";
import {
  GameNotificationRequestSchema,
  GameNotificationResultSchema,
  isPushHandle,
  NotificationsBridgeEventSchema,
  OgsPushDataSchema,
  PushConsentResultSchema,
  PushHandleSchema,
  PushSubscriptionRequestSchema,
} from "./push";

const handle = "ph_abcdefghijklmnop";

describe("push handles", () => {
  it("accepts ph_ followed by 16-64 url-safe characters", () => {
    expect(PushHandleSchema.safeParse(handle).success).toBe(true);
    expect(PushHandleSchema.safeParse(`ph_${"a".repeat(64)}`).success).toBe(true);
    expect(isPushHandle(handle)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "ph_short", `ph_${"a".repeat(65)}`, "xx_abcdefghijklmnop", "ph_abc def ghijklmnop"])
      expect(isPushHandle(bad)).toBe(false);
  });
});

describe("a game's send request", () => {
  const ok = { to: [handle], title: "Your clue", body: "Moon is up." };

  it("defaults whenOpen to deliver", () => {
    expect(GameNotificationRequestSchema.parse(ok).whenOpen).toBe("deliver");
  });

  it("takes url, tag and whenOpen banner", () => {
    const parsed = GameNotificationRequestSchema.parse({
      ...ok,
      url: "https://codebreakers.example/room/KQTP",
      tag: "codebreakers-KQTP",
      whenOpen: "banner",
    });
    expect(parsed).toMatchObject({ tag: "codebreakers-KQTP", whenOpen: "banner" });
  });

  it("needs 1 to 100 handles", () => {
    expect(GameNotificationRequestSchema.safeParse({ ...ok, to: [] }).success).toBe(false);
    const many = Array.from({ length: 101 }, (_, i) => `ph_${String(i).padStart(16, "0")}`);
    expect(GameNotificationRequestSchema.safeParse({ ...ok, to: many }).success).toBe(false);
    expect(GameNotificationRequestSchema.safeParse({ ...ok, to: many.slice(0, 100) }).success).toBe(true);
  });

  it("limits title to 60 and body to 180 characters, and needs both", () => {
    expect(GameNotificationRequestSchema.safeParse({ ...ok, title: "t".repeat(60) }).success).toBe(true);
    expect(GameNotificationRequestSchema.safeParse({ ...ok, title: "t".repeat(61) }).success).toBe(false);
    expect(GameNotificationRequestSchema.safeParse({ ...ok, body: "b".repeat(180) }).success).toBe(true);
    expect(GameNotificationRequestSchema.safeParse({ ...ok, body: "b".repeat(181) }).success).toBe(false);
    expect(GameNotificationRequestSchema.safeParse({ ...ok, title: "" }).success).toBe(false);
    expect(GameNotificationRequestSchema.safeParse({ ...ok, body: "" }).success).toBe(false);
  });

  it("rejects a url that isn't one, a bad whenOpen and a long tag", () => {
    expect(GameNotificationRequestSchema.safeParse({ ...ok, url: "nope" }).success).toBe(false);
    expect(GameNotificationRequestSchema.safeParse({ ...ok, whenOpen: "never" }).success).toBe(false);
    expect(GameNotificationRequestSchema.safeParse({ ...ok, tag: "t".repeat(65) }).success).toBe(false);
  });
});

describe("results", () => {
  it("is one status per handle", () => {
    for (const status of ["sent", "not_permitted", "gone", "failed"])
      expect(GameNotificationResultSchema.safeParse({ results: [{ to: handle, status }] }).success).toBe(true);
    expect(GameNotificationResultSchema.safeParse({ results: [{ to: handle, status: "maybe" }] }).success).toBe(false);
  });

  it("consent is granted with a handle, or denied", () => {
    expect(PushConsentResultSchema.parse({ status: "granted", handle })).toEqual({ status: "granted", handle });
    expect(PushConsentResultSchema.parse({ status: "denied" })).toEqual({ status: "denied" });
    expect(PushConsentResultSchema.safeParse({ status: "granted" }).success).toBe(false);
  });
});

describe("what a device receives", () => {
  it("carries the game, the url, whenOpen and an optional tag", () => {
    const data = { type: "game-push", appId: "codebreakers", url: "https://c.example/", whenOpen: "deliver" };
    expect(OgsPushDataSchema.parse(data)).toEqual(data);
    expect(OgsPushDataSchema.parse({ ...data, tag: "t" }).tag).toBe("t");
    expect(OgsPushDataSchema.safeParse({ ...data, type: "game-invite" }).success).toBe(false);
  });

  it("the bridge hands the page a swallowed push", () => {
    const event = { type: "NOTIFICATION", notification: { title: "T", body: "B", url: "https://c.example/" } };
    expect(NotificationsBridgeEventSchema.parse(event)).toEqual(event);
  });
});

describe("a web push subscription", () => {
  it("needs an https endpoint and both keys", () => {
    const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "BPk", auth: "au" } };
    expect(PushSubscriptionRequestSchema.parse({ subscription: sub })).toEqual({ subscription: sub });
    expect(PushSubscriptionRequestSchema.parse({ subscription: sub, handle }).handle).toBe(handle);
    expect(
      PushSubscriptionRequestSchema.safeParse({ subscription: { ...sub, endpoint: "http://push.example/abc" } }).success,
    ).toBe(false);
    expect(PushSubscriptionRequestSchema.safeParse({ subscription: { endpoint: sub.endpoint, keys: {} } }).success).toBe(false);
  });
});
