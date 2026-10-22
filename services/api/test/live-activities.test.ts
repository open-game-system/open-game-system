import { initialSession, type SessionState } from "@open-game-system/ogs-protocol";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import app from "../src/index";
import { issueToken } from "../src/lib/identity";
import {
  apnsLiveActivitySender,
  apnsSenderFor,
  ENDED_SHOWN_MS,
  type LiveActivityPush,
  liveActivityPayload,
  notifySession,
  OGS_BUNDLE_ID,
  ogsApnsCredential,
  type PushOutcome,
  publishLiveActivity,
  type SenderFor,
} from "../src/lib/live-activities";
import { registerApp } from "../src/lib/native-apps";
import { storeCredentials } from "../src/lib/push-credentials";
import { openTestD1, type TestD1 } from "./support/d1";
import { p8Pair } from "./support/keys";

/**
 * Remote Live Activity updates (docs/acceptance/2026-10-21-live-activities.feature, "Remote updates
 * through APNs"): the token routes, and the couch session's pushes, against a real local D1 and a
 * fake APNs (never Apple).
 */
const SECRET = "live-activities-secret";
const T0 = 1_760_000_000_000;
let d1: TestD1;

beforeAll(async () => {
  d1 = await openTestD1();
});
afterAll(() => d1.dispose());
beforeEach(async () => {
  await d1.reset();
  await d1.db.batch([
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('mom', 'mom', 'Mom', 'sun')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('kid', 'kid', 'Kid', 'rocket')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('stranger', 'st', 'S', 'owl')",
    ),
    d1.db
      .prepare(
        "INSERT INTO couch_sessions (id, host_profile_id, code, tv_name, created_at) VALUES ('s1', 'mom', 'KXTE42', 'Living room', ?)",
      )
      .bind(Date.now()),
    d1.db
      .prepare(
        "INSERT INTO session_members (session_id, profile_id, joined_at) VALUES ('s1', 'kid', ?)",
      )
      .bind(Date.now()),
  ]);
});
afterEach(() => vi.restoreAllMocks());

const ON = { LIVE_ACTIVITIES: "on" };
const env = (extra: Record<string, string> = ON) => ({
  DB: d1.db,
  OGS_JWT_SECRET: SECRET,
  ...extra,
});
const phone = (sub: string) =>
  issueToken({ sub, did: `${sub}-phone`, kind: "phone" }, SECRET, {
    now: Date.now(),
    ttlSeconds: 60,
  });
const TOKEN = "ab".repeat(32);
const registration = (patch: Record<string, unknown> = {}) => ({
  activityId: "act-1",
  pushToken: TOKEN,
  app: "ogs",
  environment: "sandbox",
  ...patch,
});
const Body = z.record(z.string(), z.unknown());
const errorCode = (body: unknown) =>
  z.object({ error: z.object({ code: z.string() }) }).parse(body).error.code;

async function call(method: string, path: string, token: string, body?: unknown, e = env()) {
  const res = await app.request(
    `/api/v1/sessions${path}`,
    {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    e,
  );
  const text = await res.text();
  return { status: res.status, body: text ? Body.parse(JSON.parse(text)) : null };
}

const rows = async () =>
  (await d1.db.prepare("SELECT * FROM live_activities ORDER BY activity_id").all()).results;

describe("POST /sessions/:sid/live-activities", () => {
  it("stores the host's activity token under the session", async () => {
    const r = await call("POST", "/s1/live-activities", await phone("mom"), registration());
    expect(r).toEqual({ status: 201, body: { activityId: "act-1" } });
    expect(await rows()).toEqual([
      expect.objectContaining({
        activity_id: "act-1",
        session_id: "s1",
        profile_id: "mom",
        app: "ogs",
        push_token: TOKEN,
        apns_environment: "sandbox",
      }),
    ]);
  });

  it("a member may register too, and a new token replaces the activity's old one", async () => {
    await call("POST", "/s1/live-activities", await phone("kid"), registration());
    await call(
      "POST",
      "/s1/live-activities",
      await phone("kid"),
      registration({ pushToken: "cd".repeat(32) }),
    );
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ profile_id: "kid", push_token: "cd".repeat(32) });
  });

  it("refuses a profile that isn't on the couch, an unknown session, and a bad body", async () => {
    const stranger = await call(
      "POST",
      "/s1/live-activities",
      await phone("stranger"),
      registration(),
    );
    expect([stranger.status, errorCode(stranger.body)]).toEqual([403, "not_a_member"]);
    const missing = await call("POST", "/nope/live-activities", await phone("mom"), registration());
    expect([missing.status, errorCode(missing.body)]).toEqual([404, "session_not_found"]);
    const bad = await call(
      "POST",
      "/s1/live-activities",
      await phone("mom"),
      registration({ pushToken: "zz" }),
    );
    expect([bad.status, errorCode(bad.body)]).toEqual([400, "invalid_body"]);
    expect(await rows()).toEqual([]);
  });

  it("needs a token", async () => {
    const res = await app.request("/api/v1/sessions/s1/live-activities", { method: "POST" }, env());
    expect(res.status).toBe(401);
  });

  it("is 404 feature_disabled while LIVE_ACTIVITIES isn't on", async () => {
    const flags: Record<string, string>[] = [{}, { LIVE_ACTIVITIES: "off" }];
    for (const flag of flags) {
      const r = await call(
        "POST",
        "/s1/live-activities",
        await phone("mom"),
        registration(),
        env(flag),
      );
      expect([r.status, errorCode(r.body)]).toEqual([404, "feature_disabled"]);
      const d = await call(
        "DELETE",
        "/s1/live-activities/act-1",
        await phone("mom"),
        undefined,
        env(flag),
      );
      expect([d.status, errorCode(d.body)]).toEqual([404, "feature_disabled"]);
    }
  });
});

describe("DELETE /sessions/:sid/live-activities/:activityId", () => {
  it("forgets the profile's own activity, and only its own", async () => {
    await call("POST", "/s1/live-activities", await phone("mom"), registration());
    const notMine = await call("DELETE", "/s1/live-activities/act-1", await phone("kid"));
    expect([notMine.status, errorCode(notMine.body)]).toEqual([404, "activity_not_found"]);
    const mine = await call("DELETE", "/s1/live-activities/act-1", await phone("mom"));
    expect(mine).toEqual({ status: 204, body: null });
    expect(await rows()).toEqual([]);
  });
});

function fakeSender(answer: (push: LiveActivityPush) => PushOutcome = () => ({ ok: true })) {
  const pushes: LiveActivityPush[] = [];
  const senderFor: SenderFor = vi.fn(async (appName: string) =>
    appName === "unsendable"
      ? null
      : {
          bundleId: appName === "ogs" ? OGS_BUNDLE_ID : `tv.${appName}.app`,
          sender: {
            send: async (push: LiveActivityPush) => {
              pushes.push(push);
              return answer(push);
            },
          },
        },
  );
  return { pushes, senderFor };
}

async function register(activityId: string, patch: Record<string, string> = {}) {
  await d1.db
    .prepare(
      "INSERT INTO live_activities (activity_id, session_id, profile_id, app, push_token, apns_environment, updated_at) VALUES (?, 's1', 'mom', ?, ?, ?, 0)",
    )
    .bind(activityId, patch.app ?? "ogs", patch.token ?? TOKEN, patch.environment ?? "production")
    .run();
}

const UPDATE = {
  kind: "update" as const,
  content: {
    appId: "rocket-crew",
    phase: "playing" as const,
    status: "Mission 6",
    yourTurn: false,
  },
};

describe("liveActivityPayload", () => {
  it("an update carries the content with its time (seconds for APNs, ms for the app)", () => {
    expect(liveActivityPayload(UPDATE, T0 + 999)).toEqual({
      aps: {
        timestamp: Math.floor((T0 + 999) / 1000),
        event: "update",
        "content-state": {
          phase: "playing",
          status: "Mission 6",
          yourTurn: false,
          updatedAt: T0 + 999,
        },
      },
    });
  });

  it("an end says Game over and leaves the lock screen two minutes later", () => {
    expect(liveActivityPayload({ kind: "end" }, T0)).toEqual({
      aps: {
        timestamp: T0 / 1000,
        event: "end",
        "content-state": { phase: "ended", status: "Game over", yourTurn: false, updatedAt: T0 },
        "dismissal-date": (T0 + ENDED_SHOWN_MS) / 1000,
      },
    });
  });
});

describe("notifySession", () => {
  it("sends each registered activity the update, on its app's liveactivity topic", async () => {
    await register("a1");
    await register("a2", { app: "settlewood", environment: "sandbox", token: "cd".repeat(32) });
    const { pushes, senderFor } = fakeSender();
    const result = await notifySession(d1.db, "s1", UPDATE, senderFor, T0);
    expect(result).toEqual({ sent: 2, gone: 0, failed: 0, unsendable: 0 });
    expect(pushes.map((p) => [p.token, p.environment, p.topic, p.priority])).toEqual([
      [TOKEN, "production", "org.opengame.app.push-type.liveactivity", 5],
      ["cd".repeat(32), "sandbox", "tv.settlewood.app.push-type.liveactivity", 5],
    ]);
    expect(pushes[0]?.payload).toEqual(liveActivityPayload(UPDATE, T0));
    expect(await rows()).toHaveLength(2);
  });

  it("deletes a dead token and keeps the rest", async () => {
    await register("a1");
    await register("a2", { token: "cd".repeat(32) });
    await register("a3", { token: "ef".repeat(32) });
    const { senderFor } = fakeSender((p) =>
      p.token === TOKEN
        ? { ok: false, gone: true, reason: "BadDeviceToken" }
        : p.token === "ef".repeat(32)
          ? { ok: false, gone: false, reason: "TooManyRequests" }
          : { ok: true },
    );
    expect(await notifySession(d1.db, "s1", UPDATE, senderFor, T0)).toEqual({
      sent: 1,
      gone: 1,
      failed: 1,
      unsendable: 0,
    });
    expect(
      (await rows()).map((r) => z.object({ activity_id: z.string() }).parse(r).activity_id),
    ).toEqual(["a2", "a3"]);
  });

  it("an end goes out at high priority and clears the session's activities", async () => {
    await register("a1");
    const { pushes, senderFor } = fakeSender();
    await notifySession(d1.db, "s1", { kind: "end" }, senderFor, T0);
    expect(pushes[0]?.priority).toBe(10);
    expect(await rows()).toEqual([]);
  });

  it("counts activities whose app can't send yet (no APNs key) and keeps them", async () => {
    await register("a1", { app: "unsendable" });
    await register("a2", { app: "unsendable", token: "cd".repeat(32) });
    const { pushes, senderFor } = fakeSender();
    expect(await notifySession(d1.db, "s1", UPDATE, senderFor, T0)).toEqual({
      sent: 0,
      gone: 0,
      failed: 0,
      unsendable: 2,
    });
    expect(senderFor).toHaveBeenCalledTimes(1);
    expect(pushes).toEqual([]);
    expect(await rows()).toHaveLength(2);
  });
});

const playing = (label: string): SessionState => ({
  ...initialSession("s1", "mom"),
  cast: true,
  screen: "game",
  current: {
    appId: "rocket-crew",
    instanceId: "i",
    mode: "new",
    roster: [],
    label,
    startedAt: 1,
    viewUrl: null,
    hostDeviceId: null,
  },
});

describe("publishLiveActivity (the couch session's hook)", () => {
  const deps = (senderFor: SenderFor) => ({ senderFor, now: () => T0, version: "test" });

  it("pushes when the TV's label changes, and logs one wide event without tokens", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await register("a1");
    const { pushes, senderFor } = fakeSender();
    const result = await publishLiveActivity(
      env(),
      playing("Round 2"),
      playing("Mission 6"),
      deps(senderFor),
    );
    expect(result).toEqual({ sent: 1, gone: 0, failed: 0, unsendable: 0 });
    expect(pushes[0]?.payload).toMatchObject({
      aps: { event: "update", "content-state": { status: "Mission 6" } },
    });
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "live_activity.push",
        session_id: "s1",
        change: "update",
        sent: 1,
      }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain(TOKEN);
  });

  it("does nothing when nothing the activity shows changed, or the flag is off", async () => {
    await register("a1");
    const { pushes, senderFor } = fakeSender();
    expect(
      await publishLiveActivity(env(), playing("A"), playing("A"), deps(senderFor)),
    ).toBeNull();
    expect(
      await publishLiveActivity(env({}), playing("A"), playing("B"), deps(senderFor)),
    ).toBeNull();
    expect(pushes).toEqual([]);
  });

  it("never throws: a failing send is an error wide event and the couch carries on", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await register("a1");
    const senderFor: SenderFor = async () => {
      throw new Error("APNs exploded");
    };
    await expect(
      publishLiveActivity(env(), playing("A"), playing("B"), deps(senderFor)),
    ).resolves.toBeNull();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "live_activity.push", outcome: "error" }),
    );
  });
});

describe("the real sender (APNs at fetch)", () => {
  type Call = { url: string; init: RequestInit };
  const fakeFetch = (res: () => Response) => {
    const calls: Call[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return res();
    };
    return { calls, fetcher };
  };
  const cred = async () => ({
    keyId: "KEY1234567",
    teamId: "34S957HD77",
    p8: (await p8Pair()).pem,
  });
  const push = (environment: "sandbox" | "production"): LiveActivityPush => ({
    token: TOKEN,
    environment,
    topic: "org.opengame.app.push-type.liveactivity",
    priority: 5,
    payload: { aps: { event: "update" } },
  });

  it("POSTs a liveactivity push with the provider token to the token's APNs environment", async () => {
    const { calls, fetcher } = fakeFetch(() => new Response(null, { status: 200 }));
    const sender = apnsLiveActivitySender(await cred(), fetcher, () => T0);
    expect(await sender.send(push("sandbox"))).toEqual({ ok: true });
    await sender.send(push("production"));
    expect(calls.map((c) => c.url)).toEqual([
      `https://api.sandbox.push.apple.com/3/device/${TOKEN}`,
      `https://api.push.apple.com/3/device/${TOKEN}`,
    ]);
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("apns-push-type")).toBe("liveactivity");
    expect(headers.get("apns-topic")).toBe("org.opengame.app.push-type.liveactivity");
    expect(headers.get("apns-priority")).toBe("5");
    expect(headers.get("authorization")).toMatch(/^bearer ey/);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ aps: { event: "update" } });
  });

  it.each([
    [410, { reason: "Unregistered" }, true, "Unregistered"],
    [400, { reason: "BadDeviceToken" }, true, "BadDeviceToken"],
    [400, { reason: "BadTopic" }, false, "BadTopic"],
    [429, "not json", false, "apns_429"],
    [410, "not json", true, "apns_410"],
  ])("reads a %s refusal", async (status, body, gone, reason) => {
    const { fetcher } = fakeFetch(
      () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
    );
    const sender = apnsLiveActivitySender(await cred(), fetcher, () => T0);
    expect(await sender.send(push("production"))).toEqual({ ok: false, gone, reason });
  });

  it("a key that won't sign sends nothing", async () => {
    const { calls, fetcher } = fakeFetch(() => new Response(null));
    const sender = apnsLiveActivitySender(
      { keyId: "K", teamId: "T", p8: "not a key" },
      fetcher,
      () => T0,
    );
    expect(await sender.send(push("production"))).toEqual({
      ok: false,
      gone: false,
      reason: "apns_key_unusable",
    });
    expect(calls).toEqual([]);
  });
});

describe("which credentials send", () => {
  it("the OGS app: OGS's own APNs secrets, all three, else nothing", async () => {
    expect(ogsApnsCredential({})).toBeNull();
    expect(ogsApnsCredential({ APNS_KEY_ID: "K", APNS_TEAM_ID: "T" })).toBeNull();
    expect(ogsApnsCredential({ APNS_KEY_ID: "K", APNS_TEAM_ID: "T", APNS_P8: "P" })).toEqual({
      keyId: "K",
      teamId: "T",
      p8: "P",
    });
    const none = apnsSenderFor({ DB: d1.db }, fetch, () => T0);
    expect(await none("ogs")).toBeNull();
    const set = apnsSenderFor(
      { DB: d1.db, APNS_KEY_ID: "K", APNS_TEAM_ID: "T", APNS_P8: "P" },
      fetch,
      () => T0,
    );
    expect((await set("ogs"))?.bundleId).toBe("org.opengame.app");
    const other = apnsSenderFor(
      {
        DB: d1.db,
        APNS_KEY_ID: "K",
        APNS_TEAM_ID: "T",
        APNS_P8: "P",
        APNS_BUNDLE_ID: "org.opengame.dev",
      },
      fetch,
      () => T0,
    );
    expect((await other("ogs"))?.bundleId).toBe("org.opengame.dev");
  });

  it("a game's own app: nothing without PUSH_KEY_SECRET, a registered app and its uploaded key", async () => {
    expect(await apnsSenderFor({ DB: d1.db }, fetch, () => T0)("settlewood")).toBeNull();
    expect(
      await apnsSenderFor({ DB: d1.db, PUSH_KEY_SECRET: "s" }, fetch, () => T0)("settlewood"),
    ).toBeNull();
  });

  it("a game's own app with its key uploaded sends on its own bundle id", async () => {
    const secret = "push-key-secret";
    await registerApp(
      d1.db,
      { appId: "settlewood", platform: "ios", bundleId: "tv.settlewood.app", teamId: "34S957HD77" },
      1,
    );
    const senderFor = apnsSenderFor({ DB: d1.db, PUSH_KEY_SECRET: secret }, fetch, () => T0);
    expect(await senderFor("settlewood")).toBeNull();
    await storeCredentials(
      d1.db,
      "settlewood",
      { ios: { p8: (await p8Pair()).pem, keyId: "ABC123DEFG", teamId: "34S957HD77" } },
      secret,
      1,
    );
    expect((await senderFor("settlewood"))?.bundleId).toBe("tv.settlewood.app");
    // A key sealed with another secret won't open: nothing sends, nothing throws.
    expect(
      await apnsSenderFor({ DB: d1.db, PUSH_KEY_SECRET: "other" }, fetch, () => T0)("settlewood"),
    ).toBeNull();
  });
});
