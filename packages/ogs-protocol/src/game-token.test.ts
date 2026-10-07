import { describe, expect, it } from "vitest";
import {
  avatarUrl,
  GAME_TOKEN_TTL_S,
  GamePlayerSchema,
  GameTokenSchema,
  OgsProfileSchema,
  ProfileBridgeStateSchema,
} from "./game-token";

const juneau = {
  id: "p_juneau",
  handle: "juneau",
  name: "Juneau",
  avatar: "https://tv.opengame.org/art/story-nook/char-dragon.webp",
};
const claims = () => ({
  iss: "https://api.opengame.org",
  aud: "rocket-crew",
  sub: "p_juneau",
  handle: "juneau",
  name: "Juneau",
  avatar: juneau.avatar,
  iat: 1_900_000_000,
  exp: 1_900_003_600,
});

describe("game token claims", () => {
  it("a phone token for one game: profile id, @id, name and avatar", () => {
    expect(GameTokenSchema.parse(claims())).toEqual(claims());
  });

  it("a session token names its session and the players on the couch", () => {
    const session = { ...claims(), sid: "s-1", players: [juneau] };
    expect(GameTokenSchema.parse(session)).toEqual(session);
  });

  it.each([
    "iss",
    "aud",
    "sub",
    "handle",
    "name",
    "avatar",
    "iat",
    "exp",
  ])("claims without %s are rejected", (key) => {
    const rest = Object.fromEntries(Object.entries(claims()).filter(([k]) => k !== key));
    expect(GameTokenSchema.safeParse(rest).success).toBe(false);
  });

  it.each(["iss", "aud", "sub", "handle", "name"])("an empty %s is rejected", (key) => {
    expect(GameTokenSchema.safeParse({ ...claims(), [key]: "" }).success).toBe(false);
  });

  it("an empty session id is rejected", () => {
    expect(GameTokenSchema.safeParse({ ...claims(), sid: "" }).success).toBe(false);
  });

  it("the avatar must be a URL", () => {
    expect(GameTokenSchema.safeParse({ ...claims(), avatar: "dragon" }).success).toBe(false);
  });

  it.each([0, -1, 1.5])("an expiry of %s is rejected", (exp) => {
    expect(GameTokenSchema.safeParse({ ...claims(), exp }).success).toBe(false);
  });

  it.each([-1, 1.5])("an issued-at of %s is rejected", (iat) => {
    expect(GameTokenSchema.safeParse({ ...claims(), iat }).success).toBe(false);
  });

  it("an OGS app token (device claims) is not a game token", () => {
    const app = { sub: "p_juneau", did: "ipad", kind: "tablet", exp: 1_900_000_000 };
    expect(GameTokenSchema.safeParse(app).success).toBe(false);
  });

  it("a player missing its avatar is rejected", () => {
    const { avatar: _a, ...rest } = juneau;
    expect(GamePlayerSchema.safeParse(rest).success).toBe(false);
    expect(GameTokenSchema.safeParse({ ...claims(), players: [rest] }).success).toBe(false);
  });

  it("lives an hour", () => {
    expect(GAME_TOKEN_TTL_S).toBe(3600);
  });
});

describe("avatar URL", () => {
  it("is the sticker's painted art on the launcher", () => {
    expect(avatarUrl("https://tv.opengame.org", "dragon")).toBe(
      "https://tv.opengame.org/art/story-nook/char-dragon.webp",
    );
  });

  it("ignores a trailing slash on the base", () => {
    expect(avatarUrl("http://localhost:5180/", "bear")).toBe(
      "http://localhost:5180/art/story-nook/char-bear.webp",
    );
  });

  it("ignores several trailing slashes", () => {
    expect(avatarUrl("http://localhost:5180//", "owl")).toBe(
      "http://localhost:5180/art/story-nook/char-owl.webp",
    );
  });

  it("keeps an http sticker URL too", () => {
    expect(avatarUrl("https://tv.opengame.org", "http://localhost:5180/me.png")).toBe(
      "http://localhost:5180/me.png",
    );
  });

  it("only a sticker that starts with a URL scheme is a URL", () => {
    expect(avatarUrl("https://tv.opengame.org", "x-https://y")).toBe(
      "https://tv.opengame.org/art/story-nook/char-x-https://y.webp",
    );
  });

  it("keeps a sticker that is already a URL", () => {
    expect(avatarUrl("https://tv.opengame.org", "https://x.test/me.png")).toBe(
      "https://x.test/me.png",
    );
  });
});

describe("profile bridge store", () => {
  const profile = { ...juneau, token: "a.b.c" };

  it("ready carries the profile and its game token", () => {
    const s = { status: "ready", profile };
    expect(ProfileBridgeStateSchema.parse(s)).toEqual(s);
    expect(OgsProfileSchema.parse(profile)).toEqual(profile);
  });

  it.each(["asking", "none"])("%s carries nothing", (status) => {
    expect(ProfileBridgeStateSchema.parse({ status })).toEqual({ status });
  });

  it("ready without a token is rejected", () => {
    const { token: _t, ...rest } = profile;
    expect(ProfileBridgeStateSchema.safeParse({ status: "ready", profile: rest }).success).toBe(
      false,
    );
  });

  it("an empty token is rejected", () => {
    expect(OgsProfileSchema.safeParse({ ...profile, token: "" }).success).toBe(false);
  });

  it("an unknown status is rejected", () => {
    expect(ProfileBridgeStateSchema.safeParse({ status: "loading" }).success).toBe(false);
  });
});
