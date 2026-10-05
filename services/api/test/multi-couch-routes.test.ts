import {
  type Claims,
  FriendRoomSchema,
  FriendSchema,
  GameInviteResultSchema,
  GameTokenSchema,
} from "@open-game-system/ogs-protocol";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import app from "../src/index";
import { issueToken } from "../src/lib/identity";
import { recordLive, recordRoom } from "../src/lib/presence";
import { openTestD1, type TestD1 } from "./support/d1";
import { generateSigningKey } from "./support/signing-key";

/**
 * Several couches, one room (spec §7, acceptance 2026-10-05-multi-couch.feature): couch claims in
 * game tokens, invites, rooms in presence and GET /friends/rooms. Real local D1, Expo push stubbed.
 */
const SECRET = "multi-couch-secret";
let d1: TestD1;
let signingKey: string;
let pushes: { to: string; title: string; body: string; data: Record<string, string> }[];

beforeAll(async () => {
  d1 = await openTestD1();
  signingKey = await generateSigningKey("k-mc");
});
afterAll(() => d1.dispose());
beforeEach(async () => {
  await d1.reset();
  const now = Date.now();
  const profile = (id: string, handle: string, name: string, sticker: string) =>
    d1.db
      .prepare("INSERT INTO profiles (id, handle, name, sticker) VALUES (?, ?, ?, ?)")
      .bind(id, handle, name, sticker);
  const session = (id: string, host: string, code: string, tv: string, at: number) =>
    d1.db
      .prepare(
        "INSERT INTO couch_sessions (id, host_profile_id, code, tv_name, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id, host, code, tv, at);
  const friends = (a: string, b: string) =>
    d1.db
      .prepare("INSERT INTO friendships (profile_a, profile_b, created_at) VALUES (?, ?, ?)")
      .bind(a < b ? a : b, a < b ? b : a, now);
  await d1.db.batch([
    profile("jon", "jonathan.m", "Jonathan", "bear"),
    profile("mom", "mom.m", "Mom", "owl"),
    profile("sam", "sam.s", "Sam", "fox"),
    profile("kim", "kim.p", "Kim", "dragon"),
    profile("max", "max.k", "Max", "owl"),
    session("s-mumm", "jon", "MUMMAA", "Mumm TV", now),
    session("s-smith", "sam", "SMITHA", "Smith TV", now),
    session("s-park", "kim", "PARKAA", "Park TV", now),
    d1.db
      .prepare(
        "INSERT INTO session_members (session_id, profile_id, joined_at) VALUES ('s-mumm', 'mom', ?)",
      )
      .bind(now),
    friends("jon", "sam"),
    friends("jon", "kim"),
    friends("sam", "kim"),
    d1.db.prepare(
      "INSERT INTO profile_devices (device_id, profile_id, kind, name) VALUES ('sam-phone', 'sam', 'phone', 'Sam''s phone')",
    ),
    d1.db.prepare(
      "INSERT INTO devices (ogs_device_id, platform, push_token) VALUES ('sam-phone', 'ios', 'ExponentPushToken[sam]')",
    ),
  ]);
  pushes = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const sent = z
      .object({
        to: z.string(),
        title: z.string(),
        body: z.string(),
        data: z.record(z.string(), z.string()),
      })
      .parse(JSON.parse(String(init.body)));
    pushes.push(sent);
    return Response.json({ data: [{ status: "ok", id: `ticket-${pushes.length}` }] });
  });
});
afterEach(() => vi.unstubAllGlobals());

const env = (over: Record<string, unknown> = {}) => ({
  DB: d1.db,
  OGS_JWT_SECRET: SECRET,
  OGS_GAME_SIGNING_KEY: signingKey,
  AVATAR_BASE_URL: "https://tv.test",
  ...over,
});
const tokenFor = (claims: Omit<Claims, "exp">) =>
  issueToken(claims, SECRET, { now: Date.now(), ttlSeconds: 60 });
const phone = (sub: string) => tokenFor({ sub, did: `${sub}-phone`, kind: "phone" });
const launcher = (sid: string, sub: string) =>
  tokenFor({ sub, did: `launcher-${sid}`, kind: "launcher", sid });
const Body = z.record(z.string(), z.unknown());
const claimsOf = (token: unknown) =>
  GameTokenSchema.parse(
    JSON.parse(atob(z.string().parse(token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))),
  );

async function call(
  path: string,
  token: string | null,
  body?: unknown,
  over = {},
  method = "POST",
) {
  const res = await app.request(
    path,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(over),
  );
  return { status: res.status, body: await res.json() };
}
const get = (path: string, token: string) => call(path, token, undefined, {}, "GET");
const errorCode = (r: { body: unknown }) =>
  z.object({ error: z.object({ code: z.string() }) }).parse(r.body).error.code;

describe("game tokens name the couch", () => {
  it("the TV's token carries couch { sid, label: the host's name }", async () => {
    const r = await call("/api/v1/sessions/s-mumm/game-token", await launcher("s-mumm", "jon"), {
      appId: "night-flight",
    });
    expect(r.status).toBe(200);
    expect(claimsOf(Body.parse(r.body).token).couch).toEqual({ sid: "s-mumm", label: "Jonathan" });
  });

  it("a member's phone asking with its session gets the couch claim", async () => {
    const r = await call("/api/v1/games/night-flight/token", await phone("mom"), {
      sid: "s-mumm",
    });
    expect(r.status).toBe(200);
    const claims = claimsOf(Body.parse(r.body).token);
    expect(claims.couch).toEqual({ sid: "s-mumm", label: "Jonathan" });
    expect(claims.sub).toBe("mom");
    expect(claims.sid).toBeUndefined();
  });

  it("the host's phone gets its own couch", async () => {
    const r = await call("/api/v1/games/night-flight/token", await phone("sam"), {
      sid: "s-smith",
    });
    expect(claimsOf(Body.parse(r.body).token).couch).toEqual({ sid: "s-smith", label: "Sam" });
  });

  it("a phone not on that couch: 403 not_a_member", async () => {
    const r = await call("/api/v1/games/night-flight/token", await phone("kim"), {
      sid: "s-mumm",
    });
    expect(r.status).toBe(403);
    expect(errorCode(r)).toBe("not_a_member");
  });

  it("an unknown session: 404 session_not_found", async () => {
    const r = await call("/api/v1/games/night-flight/token", await phone("kim"), { sid: "nope" });
    expect(r.status).toBe(404);
    expect(errorCode(r)).toBe("session_not_found");
  });

  it("an expired session: 404 session_not_found", async () => {
    await d1.db.prepare("UPDATE couch_sessions SET created_at = 0 WHERE id = 's-mumm'").run();
    const r = await call("/api/v1/games/night-flight/token", await phone("jon"), {
      sid: "s-mumm",
    });
    expect(r.status).toBe(404);
  });

  it("a bad body: 400", async () => {
    const r = await call("/api/v1/games/night-flight/token", await phone("jon"), { sid: 5 });
    expect(r.status).toBe(400);
  });

  it("no session: a token without couch, as before", async () => {
    const r = await call("/api/v1/games/night-flight/token", await phone("mom"));
    expect(claimsOf(Body.parse(r.body).token).couch).toBeUndefined();
  });
});

describe("POST /games/:appId/invites", () => {
  const invite = async (
    by: string,
    to: string[],
    appId = "night-flight",
    room = "KQTP",
    over = {},
  ) => call(`/api/v1/games/${appId}/invites`, await phone(by), { room, to }, over);

  it("pushes each friend and answers the play link", async () => {
    const r = await invite("jon", ["sam", "kim"]);
    expect(r.status).toBe(201);
    const body = GameInviteResultSchema.parse(r.body);
    expect(body.link).toBe("https://opengame.org/play/night-flight?room=KQTP");
    expect(body.invited).toEqual([
      { profileId: "sam", pushed: true },
      { profileId: "kim", pushed: false },
    ]);
    expect(pushes).toEqual([
      {
        to: "ExponentPushToken[sam]",
        title: "Night Flight",
        body: "Jonathan invites you to Night Flight",
        data: {
          type: "game-invite",
          appId: "night-flight",
          room: "KQTP",
          url: "https://opengame.org/play/night-flight?room=KQTP",
        },
      },
    ]);
  });

  it("PLAY_BASE_URL sets the link's origin", async () => {
    const r = await invite("jon", ["sam"], "night-flight", "KQTP", {
      PLAY_BASE_URL: "http://localhost:5173/",
    });
    expect(GameInviteResultSchema.parse(r.body).link).toBe(
      "http://localhost:5173/play/night-flight?room=KQTP",
    );
  });

  it("a failed push still invites (pushed: false)", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ data: [{ status: "error" }] }));
    const r = await invite("jon", ["sam"]);
    expect(r.status).toBe(201);
    expect(GameInviteResultSchema.parse(r.body).invited).toEqual([
      { profileId: "sam", pushed: false },
    ]);
  });

  it("a push that throws still invites (pushed: false)", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    const r = await invite("jon", ["sam"]);
    expect(GameInviteResultSchema.parse(r.body).invited).toEqual([
      { profileId: "sam", pushed: false },
    ]);
  });

  it("only friends: 403 not_a_friend, and nobody is pushed", async () => {
    const r = await invite("jon", ["sam", "max"]);
    expect(r.status).toBe(403);
    expect(errorCode(r)).toBe("not_a_friend");
    expect(pushes).toEqual([]);
  });

  it("only multiCouch games: 409 not_multi_couch", async () => {
    const r = await invite("jon", ["sam"], "rocket-crew");
    expect(r.status).toBe(409);
    expect(errorCode(r)).toBe("not_multi_couch");
  });

  it("an unknown game: 404 game_not_found", async () => {
    const r = await invite("jon", ["sam"], "nope");
    expect(r.status).toBe(404);
    expect(errorCode(r)).toBe("game_not_found");
  });

  it("a bad room or nobody to invite: 400", async () => {
    expect((await invite("jon", ["sam"], "night-flight", "a b")).status).toBe(400);
    expect((await invite("jon", [])).status).toBe(400);
  });

  it("the launcher can't invite (phones and tablets only)", async () => {
    const r = await call("/api/v1/games/night-flight/invites", await launcher("s-mumm", "jon"), {
      room: "KQTP",
      to: ["sam"],
    });
    expect(r.status).toBe(403);
  });
});

describe("rooms in presence", () => {
  const live = async (sid: string, appId: string | null, room: string | null, at: number) => {
    await recordLive(d1.db, sid, { appId }, at);
    await recordRoom(d1.db, sid, appId && room ? { appId, room } : null, at);
  };

  it("a friend casting a game in a room shows the room", async () => {
    await live("s-mumm", "night-flight", "KQTP", 1);
    const r = await get("/api/v1/friends", await phone("kim"));
    const friends = FriendSchema.array().parse(r.body);
    expect(friends.find((f) => f.id === "jon")?.presence).toEqual({
      kind: "casting",
      sessionId: "s-mumm",
      tvName: "Mumm TV",
      game: { appId: "night-flight", name: "Night Flight" },
      room: "KQTP",
    });
  });

  it("without a room, presence is as before", async () => {
    await live("s-mumm", "night-flight", null, 1);
    const r = await get("/api/v1/friends", await phone("kim"));
    const jon = FriendSchema.array()
      .parse(r.body)
      .find((f) => f.id === "jon");
    expect(jon?.presence).toEqual({
      kind: "casting",
      sessionId: "s-mumm",
      tvName: "Mumm TV",
      game: { appId: "night-flight", name: "Night Flight" },
    });
  });

  it("recordRoom(null) clears the room", async () => {
    await live("s-mumm", "night-flight", "KQTP", 1);
    await recordRoom(d1.db, "s-mumm", null, 2);
    const row = await d1.db.prepare("SELECT * FROM session_rooms").first();
    expect(row).toBeNull();
  });

  it("a member playing on a friend's TV in a room shows it too", async () => {
    await d1.db.batch([
      d1.db.prepare(
        "INSERT INTO friendships (profile_a, profile_b, created_at) VALUES ('kim', 'mom', 1)",
      ),
    ]);
    await live("s-mumm", "night-flight", "KQTP", 1);
    const r = await get("/api/v1/friends", await phone("kim"));
    const mom = FriendSchema.array()
      .parse(r.body)
      .find((f) => f.id === "mom");
    expect(mom?.presence).toMatchObject({ kind: "playing", room: "KQTP" });
  });
});

describe("GET /friends/rooms — Join with your couch", () => {
  const live = async (sid: string, appId: string, room: string | null, at: number) => {
    await recordLive(d1.db, sid, { appId }, at);
    await recordRoom(d1.db, sid, room ? { appId, room } : null, at);
  };
  const rooms = async (who: string) =>
    FriendRoomSchema.array().parse((await get("/api/v1/friends/rooms", await phone(who))).body);

  it("groups friends' couches by game and room, first to arrive first", async () => {
    await live("s-smith", "night-flight", "KQTP", 20);
    await live("s-mumm", "night-flight", "KQTP", 10);
    expect(await rooms("kim")).toEqual([
      {
        appId: "night-flight",
        game: { appId: "night-flight", name: "Night Flight" },
        room: "KQTP",
        couches: [
          {
            sessionId: "s-mumm",
            label: "Jonathan",
            host: { id: "jon", handle: "jonathan.m", name: "Jonathan", sticker: "bear" },
          },
          {
            sessionId: "s-smith",
            label: "Sam",
            host: { id: "sam", handle: "sam.s", name: "Sam", sticker: "fox" },
          },
        ],
        joined: false,
      },
    ]);
  });

  it("says joined once my own couch is in the room, and lists it", async () => {
    await live("s-mumm", "night-flight", "KQTP", 10);
    await live("s-park", "night-flight", "KQTP", 30);
    const [room] = await rooms("kim");
    expect(room?.joined).toBe(true);
    expect(room?.couches.map((c) => c.label)).toEqual(["Jonathan", "Kim"]);
  });

  it("a room with only my own couch is not listed", async () => {
    await live("s-park", "night-flight", "KQTP", 30);
    expect(await rooms("kim")).toEqual([]);
  });

  it("strangers' rooms and games without a room are not listed", async () => {
    await live("s-mumm", "night-flight", null, 10);
    expect(await rooms("max")).toEqual([]);
    expect(await rooms("kim")).toEqual([]);
  });

  it("single-couch games are not listed even with a room", async () => {
    await live("s-mumm", "rocket-crew", "PQWS", 10);
    expect(await rooms("kim")).toEqual([]);
  });

  it("separate rooms are separate cards, newest first", async () => {
    await live("s-mumm", "night-flight", "KQTP", 10);
    await live("s-smith", "night-flight", "ZZZZ", 20);
    expect((await rooms("kim")).map((r) => r.room)).toEqual(["ZZZZ", "KQTP"]);
  });

  it("a TV that is no longer live drops out", async () => {
    await live("s-mumm", "night-flight", "KQTP", 10);
    await recordLive(d1.db, "s-mumm", null, 11);
    expect(await rooms("kim")).toEqual([]);
  });
});
