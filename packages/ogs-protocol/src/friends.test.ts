import { describe, expect, it } from "vitest";
import {
  AddFriendSchema,
  CastingFriendSchema,
  derivePresence,
  type Friend,
  FriendInviteSchema,
  FriendOutcomeSchema,
  FriendRequestSchema,
  FriendRequestsSchema,
  FriendSchema,
  formatInviteCode,
  INVITE_TTL_MS,
  inviteTokenFromUrl,
  isInviteCode,
  normaliseInviteCode,
  ONLINE_WINDOW_MS,
  type Presence,
  PresenceSchema,
  PublicProfileSchema,
  RedeemInviteSchema,
  sortFriends,
} from "./friends";

const mom = { id: "p_mom", handle: "mom.m", name: "Mom", sticker: "owl" };
const max = { id: "p_max", handle: "max.k", name: "Max", sticker: "firefly" };
const rocket = { appId: "rocket-crew", name: "Rocket Crew" };
const live = (game: typeof rocket | null = null) => ({
  sessionId: "s-1",
  tvName: "Living room TV",
  game,
});
const NOW = 1_800_000_000_000;

describe("constants", () => {
  it("an invite lasts 10 minutes; online means seen in the last 5", () => {
    expect(INVITE_TTL_MS).toBe(600_000);
    expect(ONLINE_WINDOW_MS).toBe(300_000);
  });
});

describe("PublicProfileSchema — what a friend sees", () => {
  it("is id, @id, name and sticker, and drops anything else", () => {
    expect(PublicProfileSchema.parse({ ...mom, library: ["x"], email: "m@x" })).toEqual(mom);
  });

  it.each(["id", "handle", "name", "sticker"])("needs %s", (key) => {
    const rest = Object.fromEntries(Object.entries(mom).filter(([k]) => k !== key));
    expect(PublicProfileSchema.safeParse(rest).success).toBe(false);
  });
});

describe("PresenceSchema", () => {
  it.each<Presence>([
    { kind: "casting", sessionId: "s-1", tvName: "Living room TV", game: null },
    { kind: "casting", sessionId: "s-1", tvName: "Living room TV", game: rocket },
    { kind: "playing", sessionId: "s-1", tvName: "Living room TV", game: rocket },
    { kind: "online" },
    { kind: "offline", lastSeenAt: null },
    { kind: "offline", lastSeenAt: NOW },
  ])("accepts %o", (p) => {
    expect(PresenceSchema.parse(p)).toEqual(p);
  });

  it("playing always names its game", () => {
    expect(
      PresenceSchema.safeParse({ kind: "playing", sessionId: "s", tvName: "TV", game: null })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown kind and an offline without lastSeenAt", () => {
    expect(PresenceSchema.safeParse({ kind: "away" }).success).toBe(false);
    expect(PresenceSchema.safeParse({ kind: "offline" }).success).toBe(false);
  });
});

describe("FriendSchema", () => {
  it("is a public profile with presence and since", () => {
    const f = { ...mom, presence: { kind: "online" }, since: NOW };
    expect(FriendSchema.parse(f)).toEqual(f);
    expect(FriendSchema.safeParse({ ...mom, since: NOW }).success).toBe(false);
    expect(FriendSchema.safeParse({ ...mom, presence: { kind: "online" } }).success).toBe(false);
  });
});

describe("requests, invites and outcomes", () => {
  const request = { id: "r-1", from: max, to: mom, via: "code", createdAt: NOW };

  it("a request names both profiles and how it was made", () => {
    expect(FriendRequestSchema.parse(request)).toEqual(request);
    for (const via of ["code", "link", "handle"])
      expect(FriendRequestSchema.parse({ ...request, via }).via).toBe(via);
    expect(FriendRequestSchema.safeParse({ ...request, via: "qr" }).success).toBe(false);
  });

  it("requests are split into incoming and outgoing", () => {
    const r = { incoming: [request], outgoing: [] };
    expect(FriendRequestsSchema.parse(r)).toEqual(r);
    expect(FriendRequestsSchema.safeParse({ incoming: [] }).success).toBe(false);
  });

  it("an invite carries a code, a link, a QR url and its expiry", () => {
    const inv = {
      code: "KITE-42",
      link: "https://opengame.org/add/abc",
      qr: "https://opengame.org/add/def",
      expiresAt: NOW,
    };
    expect(FriendInviteSchema.parse(inv)).toEqual(inv);
    expect(FriendInviteSchema.safeParse({ ...inv, link: "not a url" }).success).toBe(false);
    expect(FriendInviteSchema.safeParse({ ...inv, qr: "nope" }).success).toBe(false);
  });

  it("redeem takes a code (normalised) or a token, not neither", () => {
    expect(RedeemInviteSchema.parse({ code: "kite-42 " })).toEqual({ code: "KITE42" });
    expect(RedeemInviteSchema.parse({ token: "abcdefghijklmnop" })).toEqual({
      token: "abcdefghijklmnop",
    });
    expect(RedeemInviteSchema.safeParse({}).success).toBe(false);
    expect(RedeemInviteSchema.safeParse({ code: "" }).success).toBe(false);
    expect(RedeemInviteSchema.safeParse({ token: "" }).success).toBe(false);
  });

  it("add by @id takes the handle with or without the @, lowercased", () => {
    expect(AddFriendSchema.parse({ handle: " @Jonathan.M " })).toEqual({ handle: "jonathan.m" });
    expect(AddFriendSchema.parse({ handle: "max.k" })).toEqual({ handle: "max.k" });
    expect(AddFriendSchema.parse({ handle: "max@k" })).toEqual({ handle: "max@k" });
    expect(AddFriendSchema.safeParse({ handle: "@" }).success).toBe(false);
    expect(AddFriendSchema.safeParse({}).success).toBe(false);
  });

  it("an outcome is friends (with the friend) or requested (with the request)", () => {
    const friend = { ...mom, presence: { kind: "online" }, since: NOW };
    expect(FriendOutcomeSchema.parse({ status: "friends", friend })).toEqual({
      status: "friends",
      friend,
    });
    expect(FriendOutcomeSchema.parse({ status: "requested", request })).toEqual({
      status: "requested",
      request,
    });
    expect(FriendOutcomeSchema.safeParse({ status: "friends", request }).success).toBe(false);
  });

  it("a casting friend is the session, its host, its game and whether you joined", () => {
    const c = { ...live(rocket), host: mom, joined: false };
    expect(CastingFriendSchema.parse(c)).toEqual(c);
    expect(CastingFriendSchema.parse({ ...c, game: null }).game).toBeNull();
    expect(CastingFriendSchema.safeParse({ ...c, joined: undefined }).success).toBe(false);
  });
});

describe("invite codes", () => {
  it("normalises what was typed: case, spaces and dashes", () => {
    expect(normaliseInviteCode(" kite-42 ")).toBe("KITE42");
    expect(normaliseInviteCode("Ki Te 4-2")).toBe("KITE42");
  });

  it("formats a code as 4 letters, a dash, 2 digits", () => {
    expect(formatInviteCode("KITE42")).toBe("KITE-42");
    expect(formatInviteCode("kite-42")).toBe("KITE-42");
  });

  it("knows a code: 4 letters, then 2 digits 2–9 (no 0 or 1 to mistake for O, I, L)", () => {
    expect(isInviteCode("KITE42")).toBe(true);
    expect(isInviteCode("kite-42")).toBe(true);
    expect(isInviteCode("KITE4")).toBe(false);
    expect(isInviteCode("KITE422")).toBe(false);
    expect(isInviteCode("XKITE42")).toBe(false);
    expect(isInviteCode("KIT242")).toBe(false);
    expect(isInviteCode("KOTE42")).toBe(true);
    expect(isInviteCode("KITE01")).toBe(false);
    expect(isInviteCode("KITE10")).toBe(false);
  });
});

describe("inviteTokenFromUrl — a scanned QR or an opened link", () => {
  const token = "Ab3_-xYz0123456789";

  it.each([
    `https://opengame.org/add/${token}`,
    `https://opengame.org/add/${token}/`,
    `https://opengame.org/add/${token}?utm=x`,
    `opengame://add/${token}`,
    `http://localhost:8796/add/${token}`,
  ])("reads the token from %s", (url) => {
    expect(inviteTokenFromUrl(url)).toBe(token);
  });

  it.each([
    "https://opengame.org/open?url=x",
    "https://opengame.org/add/",
    "https://opengame.org/add/short",
    `https://opengame.org/add/${token}/more`,
    `https://opengame.org/x/add/${token}`,
    `https://opengame.org/add/${token}!`,
    `junk opengame://add/${token}`,
    `see https://opengame.org/add/${token}`,
    "not a url",
    "",
  ])("finds no token in %s", (url) => {
    expect(inviteTokenFromUrl(url)).toBeNull();
  });
});

describe("derivePresence", () => {
  const none = { hosting: null, joined: null, lastSeenAt: null };

  it("hosting a live session is casting, with its game if one is running", () => {
    expect(derivePresence({ ...none, hosting: live() }, NOW)).toEqual({
      kind: "casting",
      sessionId: "s-1",
      tvName: "Living room TV",
      game: null,
    });
    expect(derivePresence({ ...none, hosting: live(rocket), joined: live(rocket) }, NOW)).toEqual({
      kind: "casting",
      ...live(rocket),
    });
  });

  it("on someone's live session running a game is playing it", () => {
    expect(derivePresence({ ...none, joined: live(rocket) }, NOW)).toEqual({
      kind: "playing",
      ...live(rocket),
    });
  });

  it("on a live session with no game falls back to last seen", () => {
    expect(derivePresence({ ...none, joined: live(), lastSeenAt: NOW }, NOW)).toEqual({
      kind: "online",
    });
    expect(derivePresence({ ...none, joined: live() }, NOW)).toEqual({
      kind: "offline",
      lastSeenAt: null,
    });
  });

  it("seen within 5 minutes is online; at 5 minutes or later it is offline", () => {
    expect(derivePresence({ ...none, lastSeenAt: NOW - ONLINE_WINDOW_MS + 1 }, NOW)).toEqual({
      kind: "online",
    });
    const edge = NOW - ONLINE_WINDOW_MS;
    expect(derivePresence({ ...none, lastSeenAt: edge }, NOW)).toEqual({
      kind: "offline",
      lastSeenAt: edge,
    });
  });

  it("never seen is offline with no last seen", () => {
    expect(derivePresence(none, NOW)).toEqual({ kind: "offline", lastSeenAt: null });
    expect(derivePresence(none, 1_000)).toEqual({ kind: "offline", lastSeenAt: null });
  });
});

describe("sortFriends — casting, playing, online, offline; then by name", () => {
  const f = (name: string, presence: Presence): Friend => ({
    id: name,
    handle: name.toLowerCase(),
    name,
    sticker: "bear",
    presence,
    since: NOW,
  });
  const offline: Presence = { kind: "offline", lastSeenAt: null };

  it("orders by presence first", () => {
    const list = [
      f("A", offline),
      f("B", { kind: "online" }),
      f("C", { kind: "playing", sessionId: "s-1", tvName: "Living room TV", game: rocket }),
      f("D", { kind: "casting", ...live() }),
    ];
    expect(sortFriends(list).map((x) => x.name)).toEqual(["D", "C", "B", "A"]);
  });

  it("orders by name within a presence, ignoring case, and keeps the input", () => {
    const list = [f("nana", offline), f("Juneau", offline), f("max", offline)];
    expect(sortFriends(list).map((x) => x.name)).toEqual(["Juneau", "max", "nana"]);
    expect(list.map((x) => x.name)).toEqual(["nana", "Juneau", "max"]);
  });

  it("names differing only in case tie, and the tie breaks by @id", () => {
    const lower = { ...f("max", offline), handle: "max.z" };
    const upper = { ...f("Max", offline), handle: "max.a" };
    expect(sortFriends([lower, upper]).map((x) => x.handle)).toEqual(["max.a", "max.z"]);
  });

  it("ties on name break by @id", () => {
    const a = { ...f("Max", offline), handle: "max.z" };
    const b = { ...f("Max", offline), handle: "max.a" };
    expect(sortFriends([a, b]).map((x) => x.handle)).toEqual(["max.a", "max.z"]);
  });
});
