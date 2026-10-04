import { isOgsCast, routeGameCastEvent } from "../game-cast-route";

describe("the game's cast-kit events inside OGS (spec v3, Architecture: Cast)", () => {
  it("cast through OGS: the game's TV page becomes game.view for the launcher, not a recast", () => {
    expect(
      routeGameCastEvent(
        { type: "SET_VIEW_URL", url: "https://rc.example/tv/AB" },
        {
          ogsCast: true,
          appId: "rocket-crew",
        },
      ),
    ).toEqual({
      to: "session",
      msg: { type: "game.view", appId: "rocket-crew", url: "https://rc.example/tv/AB" },
    });
  });

  it("not cast through OGS: the old path (the cast store sends LOAD_VIEW) stays", () => {
    const event = { type: "SET_VIEW_URL" as const, url: "https://rc.example/tv/AB" };
    expect(routeGameCastEvent(event, { ogsCast: false, appId: "rocket-crew" })).toEqual({
      to: "store",
    });
  });

  it("without a known game the view can't be framed, and must not replace the launcher", () => {
    const event = { type: "SET_VIEW_URL" as const, url: "https://x.example/tv" };
    expect(routeGameCastEvent(event, { ogsCast: true, appId: null })).toEqual({ to: "drop" });
  });

  it("a relative or malformed view URL is never sent to the session", () => {
    const event = { type: "SET_VIEW_URL" as const, url: "/tv/AB" };
    expect(routeGameCastEvent(event, { ogsCast: true, appId: "rocket-crew" })).toEqual({
      to: "drop",
    });
  });

  it("cast through OGS: the game's own cast/stop buttons can't end the evening's stream", () => {
    for (const event of [
      { type: "START_CASTING" as const, deviceId: "cc" },
      { type: "STOP_CASTING" as const },
      { type: "SHOW_CAST_PICKER" as const },
    ])
      expect(routeGameCastEvent(event, { ogsCast: true, appId: "rocket-crew" })).toEqual({
        to: "drop",
      });
  });

  it("everything else goes to the cast store as before", () => {
    expect(routeGameCastEvent({ type: "SCAN_DEVICES" }, { ogsCast: true, appId: "x" })).toEqual({
      to: "store",
    });
    expect(
      routeGameCastEvent({ type: "START_CASTING", deviceId: "cc" }, { ogsCast: false, appId: "x" }),
    ).toEqual({ to: "store" });
  });
});

describe("is the TV cast through OGS?", () => {
  it("yes when the couch session has a launcher", () => {
    expect(isOgsCast({ sessionCast: true, castConnected: false, viewIsLauncher: false })).toBe(
      true,
    );
  });
  it("yes when this phone's cast shows the launcher (before the session confirms)", () => {
    expect(isOgsCast({ sessionCast: undefined, castConnected: true, viewIsLauncher: true })).toBe(
      true,
    );
  });
  it("no when a game cast its own page the old way, or nothing is cast", () => {
    expect(isOgsCast({ sessionCast: false, castConnected: true, viewIsLauncher: false })).toBe(
      false,
    );
    expect(isOgsCast({ sessionCast: undefined, castConnected: false, viewIsLauncher: true })).toBe(
      false,
    );
  });
});
