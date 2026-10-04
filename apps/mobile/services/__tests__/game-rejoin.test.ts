import type { SessionState } from "@open-game-system/ogs-protocol";
import { createGameUrls, latestGameUrl, rejoinUrl, rememberGame } from "../game-rejoin";

const START = "https://rocket-crew.example/";
const ROOM = "https://rocket-crew.example/join/PQWS?t=seat-1&tv=tv-1";

const session = (over: Partial<SessionState> = {}): SessionState => ({
  householdId: "h",
  cast: true,
  screen: "home",
  focus: null,
  page: null,
  current: null,
  suspended: [],
  remote: null,
  devices: [],
  rosters: {},
  casts: 1,
  ...over,
});

const live = (appId: string, instanceId: string): SessionState["current"] => ({
  appId,
  instanceId,
  mode: "continue",
  roster: [],
  label: "",
  startedAt: 1,
  viewUrl: null,
  hostDeviceId: "phone",
});

describe("the game's latest URL (Rejoin returns to the same room, not a new one)", () => {
  it("follows the WebView into the room the game navigated to", () => {
    expect(latestGameUrl(START, ROOM)).toBe(ROOM);
  });

  it("ignores blank and non-web navigations (about:blank, data:, empty)", () => {
    expect(latestGameUrl(ROOM, "about:blank")).toBe(ROOM);
    expect(latestGameUrl(ROOM, "data:text/html,hi")).toBe(ROOM);
    expect(latestGameUrl(ROOM, "")).toBe(ROOM);
    expect(latestGameUrl(ROOM, undefined)).toBe(ROOM);
  });

  it("accepts plain http (local dev games)", () => {
    expect(latestGameUrl(START, "http://localhost:8787/join/ABCD")).toBe(
      "http://localhost:8787/join/ABCD",
    );
  });
});

describe("remembering where a game was left", () => {
  it("cast: ties the URL to the session's live instance of that game", () => {
    expect(
      rememberGame("rocket-crew", ROOM, session({ current: live("rocket-crew", "i-1") })),
    ).toEqual({ appId: "rocket-crew", url: ROOM, instanceId: "i-1" });
  });

  it("the live instance belongs to another game, or there is no session: no instance", () => {
    expect(
      rememberGame("rocket-crew", ROOM, session({ current: live("bake-shop", "b-1") })).instanceId,
    ).toBeNull();
    expect(rememberGame("rocket-crew", ROOM, null).instanceId).toBeNull();
  });

  it("keeps one URL per game, the newest winning", () => {
    const urls = createGameUrls();
    urls.record({ appId: "rocket-crew", url: START, instanceId: null });
    urls.record({ appId: "rocket-crew", url: ROOM, instanceId: "i-1" });
    urls.record({ appId: "bake-shop", url: "https://bake.example/", instanceId: null });
    expect(urls.get("rocket-crew")).toEqual({ appId: "rocket-crew", url: ROOM, instanceId: "i-1" });
    expect(urls.get("bake-shop")?.url).toBe("https://bake.example/");
    expect(urls.get("story-nook")).toBeUndefined();
  });
});

describe("which URL a Rejoin opens", () => {
  const remembered = { appId: "rocket-crew", url: ROOM, instanceId: "i-1" };

  it("nothing remembered: none (the game's start page)", () => {
    expect(rejoinUrl("rocket-crew", { remembered: undefined, session: null, pill: null })).toBe(
      undefined,
    );
  });

  it("cast, the same instance paused on the TV: its room", () => {
    const s = session({
      suspended: [{ appId: "rocket-crew", instanceId: "i-1", label: "", at: 2 }],
    });
    expect(rejoinUrl("rocket-crew", { remembered, session: s, pill: null })).toBe(ROOM);
  });

  it("cast, the same instance live on the TV: its room", () => {
    const s = session({ current: live("rocket-crew", "i-1") });
    expect(rejoinUrl("rocket-crew", { remembered, session: s, pill: null })).toBe(ROOM);
  });

  it("cast, the session now holds a different instance of the game: not the old room", () => {
    const s = session({ current: live("rocket-crew", "i-2") });
    expect(rejoinUrl("rocket-crew", { remembered, session: s, pill: null })).toBeUndefined();
  });

  it("cast, the game is no longer in the session (finished or ended): not the old room", () => {
    expect(
      rejoinUrl("rocket-crew", { remembered, session: session(), pill: null }),
    ).toBeUndefined();
    expect(rejoinUrl("rocket-crew", { remembered, session: null, pill: null })).toBeUndefined();
  });

  it("a host follow names its instance: the room only when it is that instance", () => {
    const s = session();
    expect(
      rejoinUrl("rocket-crew", { remembered, session: s, pill: null, instanceId: "i-1" }),
    ).toBe(ROOM);
    expect(
      rejoinUrl("rocket-crew", { remembered, session: s, pill: null, instanceId: "i-9" }),
    ).toBeUndefined();
  });

  it("played on the phone (no instance): the room while its return pill is up", () => {
    const phone = { appId: "rocket-crew", url: ROOM, instanceId: null };
    const pill = { appId: "rocket-crew", name: "Rocket Crew", url: ROOM, at: 3 };
    expect(rejoinUrl("rocket-crew", { remembered: phone, session: null, pill })).toBe(ROOM);
    expect(
      rejoinUrl("rocket-crew", {
        remembered: phone,
        session: null,
        pill: { ...pill, appId: "bake-shop" },
      }),
    ).toBeUndefined();
    expect(rejoinUrl("rocket-crew", { remembered: phone, session: null, pill: null })).toBe(
      undefined,
    );
  });
});
