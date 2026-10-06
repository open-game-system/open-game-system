import type { ClientMessage, Manifest, SessionState } from "@open-game-system/ogs-protocol";
import { createGameOpener, type GameRoute } from "../game-opener";
import type { ReturnPill } from "../leave-game";

/**
 * Opening a game (spec v3, Where a game plays): a tap, the return pill, a host follow, a room join.
 * Exercised through the opener's interface with the app's state, the couch session and the router
 * replaced by in-memory stand-ins.
 */

const NOW = 1_780_000_000_000;
const FRESH = `rocket-crew-${NOW.toString(36)}`;
const START = "https://rc.example/";
const ROOM = "https://rc.example/join/PQWS?t=seat-1&tv=tv-1";

const game = (over: Partial<Manifest> = {}): Manifest => ({
  appId: "rocket-crew",
  name: "Rocket Crew",
  tagline: "",
  shape: "couch",
  tv: "optional",
  startUrl: START,
  roles: [],
  art: { tile: "/art/rc.jpg" },
  shop: {},
  instanceTtlMs: 1000,
  ...over,
});

const session = (over: Partial<SessionState> = {}): SessionState => ({
  sessionId: "s",
  hostProfileId: "pr",
  members: [],
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
  hostDeviceId: "phone-1",
});

function setup(
  opts: {
    library?: Manifest[];
    session?: SessionState | null;
    pill?: ReturnPill | null;
    ogsCast?: boolean;
  } = {},
) {
  const world = {
    library: opts.library ?? [game()],
    session: opts.session ?? null,
    pill: opts.pill ?? null,
    ogsCast: opts.ogsCast ?? false,
  };
  const sent: ClientMessage[] = [];
  const routes: GameRoute[] = [];
  const opener = createGameOpener({
    library: () => world.library,
    session: () => world.session,
    pill: () => world.pill,
    ogsCast: () => world.ogsCast,
    deviceId: () => "phone-1",
    send: (msg) => sent.push(msg),
    navigate: (route) => routes.push(route),
    now: () => NOW,
  });
  return { opener, world, sent, routes };
}

describe("a tap on a game", () => {
  it("not cast: opens its start page on this phone as a fresh sitting", () => {
    const { opener, sent, routes } = setup();
    opener.open(game());
    expect(sent).toEqual([]);
    expect(routes).toEqual([
      {
        pathname: "/game",
        params: { url: START, name: "Rocket Crew", appId: "rocket-crew", instanceId: FRESH },
      },
    ]);
  });

  it("cast: starts it in the stream with this phone as host, then opens the controller", () => {
    const { opener, sent, routes } = setup({ ogsCast: true });
    opener.open(game());
    expect(sent).toEqual([
      { type: "game.start", appId: "rocket-crew", mode: "continue", hostDeviceId: "phone-1" },
    ]);
    expect(routes).toEqual([
      {
        pathname: "/game",
        params: { url: START, name: "Rocket Crew", appId: "rocket-crew", instanceId: FRESH },
      },
    ]);
  });

  it("not cast and the game needs a TV: shows its page (whose Play asks to cast first)", () => {
    const { opener, sent, routes } = setup();
    opener.open(game({ tv: "required" }));
    expect(sent).toEqual([]);
    expect(routes).toEqual([{ pathname: "/library/[appId]", params: { appId: "rocket-crew" } }]);
  });

  it("a resume URL opens there, with the sitting unknown", () => {
    const { opener, routes } = setup();
    opener.open(game(), { resumeUrl: ROOM });
    expect(routes).toEqual([
      { pathname: "/game", params: { url: ROOM, name: "Rocket Crew", appId: "rocket-crew" } },
    ]);
  });
});

describe("Rejoin returns to the room the game was left in", () => {
  it("phone only: while that game's return pill is up", () => {
    const pill: ReturnPill = { appId: "rocket-crew", name: "Rocket Crew", url: ROOM, at: 1 };
    const { opener, routes } = setup({ pill });
    opener.remember("rocket-crew", ROOM);
    opener.open(game());
    expect(routes[0]).toEqual({
      pathname: "/game",
      params: { url: ROOM, name: "Rocket Crew", appId: "rocket-crew" },
    });
  });

  it("phone only: without the pill, a tap starts over from the start page", () => {
    const { opener, routes } = setup();
    opener.remember("rocket-crew", ROOM);
    opener.open(game());
    expect(routes[0]).toEqual({
      pathname: "/game",
      params: { url: START, name: "Rocket Crew", appId: "rocket-crew", instanceId: FRESH },
    });
  });

  it("cast: while the couch session still holds that sitting, naming it in game.start", () => {
    const { opener, world, sent, routes } = setup({
      ogsCast: true,
      session: session({ current: live("rocket-crew", "rc-1") }),
    });
    opener.remember("rocket-crew", ROOM);
    world.session = session({
      current: null,
      suspended: [{ appId: "rocket-crew", instanceId: "rc-1", label: "", at: 2 }],
    });
    opener.open(game(), { instanceId: "rc-1" });
    expect(sent).toEqual([
      {
        type: "game.start",
        appId: "rocket-crew",
        mode: "continue",
        hostDeviceId: "phone-1",
        instanceId: "rc-1",
      },
    ]);
    expect(routes[0]).toEqual({
      pathname: "/game",
      params: { url: ROOM, name: "Rocket Crew", appId: "rocket-crew", instanceId: "rc-1" },
    });
  });

  it("cast: another sitting of the same game does not reopen this one's room", () => {
    const { opener, routes } = setup({
      ogsCast: true,
      session: session({ current: live("rocket-crew", "rc-1") }),
    });
    opener.remember("rocket-crew", ROOM);
    opener.open(game(), { instanceId: "rc-2" });
    expect(routes[0]).toEqual({
      pathname: "/game",
      params: { url: START, name: "Rocket Crew", appId: "rocket-crew", instanceId: "rc-2" },
    });
  });

  it("a new sitting ignores the remembered room and any named sitting", () => {
    const pill: ReturnPill = { appId: "rocket-crew", name: "Rocket Crew", url: ROOM, at: 1 };
    const { opener, sent, routes } = setup({ pill, ogsCast: true });
    opener.remember("rocket-crew", ROOM);
    opener.open(game(), { mode: "new", instanceId: "rc-1" });
    expect(sent).toEqual([
      { type: "game.start", appId: "rocket-crew", mode: "new", hostDeviceId: "phone-1" },
    ]);
    expect(routes[0]).toEqual({
      pathname: "/game",
      params: { url: START, name: "Rocket Crew", appId: "rocket-crew", instanceId: FRESH },
    });
  });
});

describe("the return pill", () => {
  it("of a game in the library: rejoins its sitting there", () => {
    const pill: ReturnPill = {
      appId: "rocket-crew",
      name: "Rocket Crew",
      url: ROOM,
      at: 1,
      instanceId: "rc-1",
    };
    const { opener, sent, routes } = setup({ pill, ogsCast: true });
    opener.openPill(pill);
    expect(sent).toEqual([
      {
        type: "game.start",
        appId: "rocket-crew",
        mode: "continue",
        hostDeviceId: "phone-1",
        instanceId: "rc-1",
      },
    ]);
    expect(routes).toEqual([
      {
        pathname: "/game",
        params: { url: ROOM, name: "Rocket Crew", appId: "rocket-crew", instanceId: "rc-1" },
      },
    ]);
  });

  it("of a page that is not a library game: opens its URL by name alone", () => {
    const pill: ReturnPill = { appId: null, name: "Some page", url: "https://x.example/", at: 1 };
    const { opener, sent, routes } = setup({ pill });
    opener.openPill(pill);
    expect(sent).toEqual([]);
    expect(routes).toEqual([
      { pathname: "/game", params: { url: "https://x.example/", name: "Some page" } },
    ]);
  });
});

describe("a host follow (a game started from the TV with the remote)", () => {
  it("opens the game's start page on this phone, with no sitting attached", () => {
    const { opener, sent, routes } = setup({ ogsCast: true });
    opener.followHost({ appId: "rocket-crew", instanceId: "rc-1" });
    expect(sent).toEqual([]);
    expect(routes).toEqual([
      { pathname: "/game", params: { url: START, name: "Rocket Crew", appId: "rocket-crew" } },
    ]);
  });

  it("into another couch's room: the start page joins that room", () => {
    const { opener, routes } = setup({ ogsCast: true });
    opener.followHost({ appId: "rocket-crew", instanceId: "rc-1", room: "KQTP" });
    expect(routes[0]).toEqual({
      pathname: "/game",
      params: { url: `${START}?ogsRoom=KQTP`, name: "Rocket Crew", appId: "rocket-crew" },
    });
  });

  it("continuing a paused sitting returns to its room, not a fresh one", () => {
    const { opener, world, routes } = setup({
      ogsCast: true,
      session: session({ current: live("rocket-crew", "rc-1") }),
    });
    opener.remember("rocket-crew", ROOM);
    world.session = session();
    opener.followHost({ appId: "rocket-crew", instanceId: "rc-1", room: "KQTP" });
    expect(routes[0]).toEqual({
      pathname: "/game",
      params: { url: ROOM, name: "Rocket Crew", appId: "rocket-crew" },
    });
  });

  it("a game this phone just opened is not opened a second time", () => {
    const { opener, routes } = setup({ ogsCast: true });
    opener.open(game());
    opener.followHost({ appId: "rocket-crew", instanceId: "rc-1" });
    expect(routes).toHaveLength(1);
  });

  it("a game whose screen is up is not opened again; once it closes, a follow opens it", () => {
    const { opener, routes } = setup({ ogsCast: true });
    opener.opening("rocket-crew");
    opener.followHost({ appId: "rocket-crew", instanceId: "rc-1" });
    expect(routes).toEqual([]);
    opener.closed("rocket-crew");
    opener.followHost({ appId: "rocket-crew", instanceId: "rc-1" });
    expect(routes).toHaveLength(1);
  });

  it("two follows for the same game open it once", () => {
    const { opener, routes } = setup({ ogsCast: true });
    opener.followHost({ appId: "rocket-crew", instanceId: "rc-1" });
    opener.followHost({ appId: "rocket-crew", instanceId: "rc-1" });
    expect(routes).toHaveLength(1);
  });

  it("closing another game's screen keeps this one open", () => {
    const { opener, routes } = setup({ ogsCast: true });
    opener.opening("rocket-crew");
    opener.closed("night-flight");
    opener.followHost({ appId: "rocket-crew", instanceId: "rc-1" });
    expect(routes).toEqual([]);
  });

  it("a game not in the library opens nothing", () => {
    const { opener, routes } = setup({ ogsCast: true });
    opener.followHost({ appId: "night-flight", instanceId: "nf-1" });
    expect(routes).toEqual([]);
  });
});

describe("showing a game at a URL (a room join)", () => {
  it("opens it there, and a host follow for it then opens nothing", () => {
    const { opener, sent, routes } = setup({ ogsCast: true });
    opener.show(game(), `${START}?ogsRoom=KQTP`);
    opener.followHost({ appId: "rocket-crew", instanceId: "rc-1" });
    expect(sent).toEqual([]);
    expect(routes).toEqual([
      {
        pathname: "/game",
        params: { url: `${START}?ogsRoom=KQTP`, name: "Rocket Crew", appId: "rocket-crew" },
      },
    ]);
  });
});
