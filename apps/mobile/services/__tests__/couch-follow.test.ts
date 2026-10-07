import type { Manifest, SessionState } from "@open-game-system/ogs-protocol";
import { followStep, parksOnLeave } from "../couch-follow";

// Every couch phone follows the TV (join-and-invite.feature "Every phone follows the TV", spec §8).

const roomGame: Manifest = {
  appId: "rocket-crew",
  name: "Rocket Crew",
  tagline: "",
  shape: "couch",
  tv: "required",
  startUrl: "https://rc.example/",
  roles: [],
  art: { tile: "/art/rc.jpg" },
  shop: {},
  instanceTtlMs: 1000,
};
const staticTvGame: Manifest = {
  ...roomGame,
  appId: "quiz",
  name: "Quiz",
  startUrl: "https://quiz.example/play?x=1",
  tvUrl: "https://quiz.example/tv",
};

const current = (
  appId: string,
  patch: Partial<NonNullable<SessionState["current"]>> = {},
): NonNullable<SessionState["current"]> => ({
  appId,
  instanceId: `${appId}-1`,
  mode: "new",
  roster: [],
  label: "",
  startedAt: 1,
  viewUrl: null,
  hostDeviceId: "phone-dad",
  ...patch,
});

const inGame = (appId: string, room?: string) => ({
  kind: "game" as const,
  appId,
  instanceId: `${appId}-1`,
  roleId: "player",
  ...(room ? { room } : {}),
});

describe("a couch phone following the TV into a game", () => {
  it("opens the game's room: the start page with ogsRoom, so it joins the TV's room", () => {
    expect(
      followStep(inGame("rocket-crew", "KQTP"), {
        manifest: roomGame,
        openAppId: null,
        current: current("rocket-crew", { room: "KQTP" }),
      }),
    ).toEqual({
      kind: "open",
      appId: "rocket-crew",
      url: "https://rc.example/?ogsRoom=KQTP",
      replace: false,
    });
  });

  it("waits for the room when the game makes rooms (no static TV page): its start page would make a new, empty one", () => {
    expect(
      followStep(inGame("rocket-crew"), {
        manifest: roomGame,
        openAppId: null,
        current: current("rocket-crew"),
      }),
    ).toEqual({ kind: "stay" });
  });

  it("a game with a static TV page opens its start page at once", () => {
    expect(
      followStep(inGame("quiz"), {
        manifest: staticTvGame,
        openAppId: null,
        current: current("quiz"),
      }),
    ).toEqual({
      kind: "open",
      appId: "quiz",
      url: "https://quiz.example/play?x=1",
      replace: false,
    });
  });

  it("goes back to where this phone was in that same sitting, if it remembers it", () => {
    expect(
      followStep(inGame("rocket-crew", "KQTP"), {
        manifest: roomGame,
        openAppId: null,
        current: current("rocket-crew", { room: "KQTP" }),
        rejoinUrl: "https://rc.example/join/KQTP?t=seat-2",
      }),
    ).toMatchObject({ kind: "open", url: "https://rc.example/join/KQTP?t=seat-2" });
  });

  it("a game already open here stays as it is (no second copy)", () => {
    expect(
      followStep(inGame("rocket-crew", "KQTP"), {
        manifest: roomGame,
        openAppId: "rocket-crew",
        current: current("rocket-crew", { room: "KQTP" }),
      }),
    ).toEqual({ kind: "stay" });
  });

  it("a swap replaces the game open here with the new one", () => {
    expect(
      followStep(inGame("quiz"), {
        manifest: staticTvGame,
        openAppId: "rocket-crew",
        current: current("quiz"),
      }),
    ).toEqual({ kind: "open", appId: "quiz", url: "https://quiz.example/play?x=1", replace: true });
  });

  it("a game this app doesn't know opens nothing", () => {
    expect(
      followStep(inGame("mystery", "R1"), {
        manifest: undefined,
        openAppId: null,
        current: current("mystery", { room: "R1" }),
      }),
    ).toEqual({ kind: "stay" });
  });
});

describe("a couch phone following the TV home", () => {
  const launcher = { kind: "launcher" as const };

  it("Home closes the game the TV parked", () => {
    expect(
      followStep(launcher, { manifest: undefined, openAppId: "rocket-crew", current: null }),
    ).toEqual({
      kind: "close",
      appId: "rocket-crew",
    });
  });

  it("nothing open: nothing to close", () => {
    expect(followStep(launcher, { manifest: undefined, openAppId: null, current: null })).toEqual({
      kind: "stay",
    });
  });

  it("a kid's iPad not seated in the TV's game keeps the TV's game it opened itself", () => {
    expect(
      followStep(launcher, {
        manifest: undefined,
        openAppId: "rocket-crew",
        current: current("rocket-crew"),
      }),
    ).toEqual({ kind: "stay" });
  });
});

describe("leaving a game on a following phone", () => {
  it("the host leaving parks the game on the TV (as before)", () => {
    expect(parksOnLeave("rocket-crew", current("rocket-crew"), "phone-dad")).toBe(true);
  });

  it("a phone following the host steps out to the remote and leaves the TV playing", () => {
    expect(parksOnLeave("rocket-crew", current("rocket-crew"), "phone-mom")).toBe(false);
  });

  it("a game nobody hosts parks as before", () => {
    expect(
      parksOnLeave("rocket-crew", current("rocket-crew", { hostDeviceId: null }), "phone-mom"),
    ).toBe(true);
  });

  it("leaving a game that isn't the TV's current one parks as before", () => {
    expect(parksOnLeave("bake-shop", current("rocket-crew"), "phone-mom")).toBe(true);
    expect(parksOnLeave("bake-shop", null, "phone-mom")).toBe(true);
  });
});
