import { describe, expect, it } from "vitest";
import { GameToLauncherSchema, LauncherToGameSchema, OgsBridgeEventSchema } from "./frame";

const report = {
  instanceId: "rc-1",
  appId: "rocket-crew",
  status: "active",
  title: "Mission 6",
  detail: "Fixing the engine",
};
const start = {
  type: "ogs:start",
  instanceId: "rc-1",
  mode: "continue",
  roster: [{ profileId: "juneau", roleId: "fixer" }],
  token: "signed.jwt",
};

describe("launcher to game frame messages", () => {
  it.each(["continue", "new"])("ogs:start in %s mode is accepted", (mode) => {
    expect(LauncherToGameSchema.parse({ ...start, mode })).toEqual({ ...start, mode });
  });

  it.each(["instanceId", "mode", "roster", "token"])("ogs:start without %s is rejected", (key) => {
    const rest = Object.fromEntries(Object.entries(start).filter(([k]) => k !== key));
    expect(LauncherToGameSchema.safeParse(rest).success).toBe(false);
  });

  it("ogs:start with an unknown mode is rejected", () => {
    expect(LauncherToGameSchema.safeParse({ ...start, mode: "replay" }).success).toBe(false);
  });

  it.each(["ogs:suspend", "ogs:resume"])("%s is accepted", (type) => {
    expect(LauncherToGameSchema.parse({ type })).toEqual({ type });
  });

  it("a launcher message with an unknown type is rejected", () => {
    expect(LauncherToGameSchema.safeParse({ type: "ogs:ready" }).success).toBe(false);
    expect(LauncherToGameSchema.safeParse({ type: "" }).success).toBe(false);
  });
});

describe("game to launcher frame messages", () => {
  it("ogs:ready is accepted", () => {
    expect(GameToLauncherSchema.parse({ type: "ogs:ready" })).toEqual({ type: "ogs:ready" });
  });

  it("ogs:resume-point carries its label", () => {
    const msg = { type: "ogs:resume-point", label: "Mission 6" };
    expect(GameToLauncherSchema.parse(msg)).toEqual(msg);
    expect(GameToLauncherSchema.safeParse({ type: "ogs:resume-point" }).success).toBe(false);
  });

  it("ogs:instance carries a valid instance report", () => {
    const msg = { type: "ogs:instance", report };
    expect(GameToLauncherSchema.parse(msg)).toEqual(msg);
    expect(
      GameToLauncherSchema.safeParse({ type: "ogs:instance", report: { appId: "x" } }).success,
    ).toBe(false);
  });

  it("a frame message from the game with an unknown type is rejected", () => {
    expect(GameToLauncherSchema.safeParse({ type: "ogs:start" }).success).toBe(false);
    expect(GameToLauncherSchema.safeParse({ type: "" }).success).toBe(false);
  });
});

describe("app-bridge events from a game page", () => {
  it("INSTANCE_REPORT carries a valid instance report", () => {
    const ev = { type: "INSTANCE_REPORT", report };
    expect(OgsBridgeEventSchema.parse(ev)).toEqual(ev);
    expect(OgsBridgeEventSchema.safeParse({ type: "INSTANCE_REPORT" }).success).toBe(false);
  });

  it("a bridge event with an unknown type is rejected", () => {
    expect(OgsBridgeEventSchema.safeParse({ type: "ogs:instance", report }).success).toBe(false);
    expect(OgsBridgeEventSchema.safeParse({ type: "", report }).success).toBe(false);
  });
});

describe("ogs:start carries the session game token and the players", () => {
  const players = [
    {
      id: "p_jonathan",
      handle: "jonathan.m",
      name: "Jonathan",
      avatar: "https://tv.opengame.org/art/story-nook/char-bear.webp",
    },
  ];

  it("players on the couch are accepted", () => {
    const msg = { ...start, players };
    expect(LauncherToGameSchema.parse(msg)).toEqual(msg);
  });

  it("a player without an avatar URL is rejected", () => {
    const msg = { ...start, players: [{ ...players[0], avatar: "bear" }] };
    expect(LauncherToGameSchema.safeParse(msg).success).toBe(false);
  });
});
