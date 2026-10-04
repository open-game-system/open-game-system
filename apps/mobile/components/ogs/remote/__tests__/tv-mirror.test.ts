import {
  initialSession,
  type Manifest,
  playItem,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import { pausedWhen, tvMirror } from "../tv-mirror";

const game = (appId: string, name: string, ages?: string): Manifest => ({
  appId,
  name,
  tagline: `${name} tagline`,
  shape: "couch",
  tv: "required",
  startUrl: `https://${appId}.example/`,
  roles: [],
  art: { tile: `/art/${appId}/tv.jpg` },
  shop: ages ? { ages } : {},
  instanceTtlMs: 1000,
});

const rocket = game("rocket-crew", "Rocket Crew", "4+");
const bake = game("bake-shop", "Bake Shop", "2+");
const duel = game("word-duel", "Word Duel", "8+");
const library = [rocket, bake, duel];

// Sunday 4 Oct 2026, 20:00 local.
const NOW = new Date(2026, 9, 4, 20, 0).getTime();
const MIN = 60 * 1000;

const session = (patch: Partial<SessionState> = {}): SessionState => ({
  ...initialSession("s1", "p-dad"),
  cast: true,
  ...patch,
});

const mirror = (state: SessionState | null) => tvMirror({ state, library, now: NOW });

describe("pausedWhen: the TV's words for when a sitting was paused", () => {
  it("under two minutes: just now", () => {
    expect(pausedWhen(NOW - MIN, NOW)).toBe("just now");
  });
  it("earlier today: at the clock time", () => {
    expect(pausedWhen(new Date(2026, 9, 4, 19, 2).getTime(), NOW)).toBe("at 7:02");
  });
  it("yesterday", () => {
    expect(pausedWhen(new Date(2026, 9, 3, 21, 0).getTime(), NOW)).toBe("yesterday");
  });
  it("this week: the weekday", () => {
    expect(pausedWhen(new Date(2026, 9, 1, 18, 0).getTime(), NOW)).toBe("Thursday");
  });
  it("longer ago: month and day", () => {
    expect(pausedWhen(new Date(2026, 8, 1, 18, 0).getTime(), NOW)).toBe("Sep 1");
  });
});

describe("tvMirror: the phone shows what the TV shows", () => {
  it("no session: Home, no game, the arrows pick one", () => {
    expect(mirror(null)).toEqual({
      kind: "home",
      game: null,
      title: "Home",
      chip: null,
      resume: null,
      action: "Pick a game with the arrows",
      kids: [],
    });
  });

  it("Home with the ring on a game you haven't started: its art, OK opens it", () => {
    expect(mirror(session({ focus: "game:bake-shop" }))).toMatchObject({
      kind: "home",
      game: bake,
      title: "Bake Shop",
      chip: null,
      resume: null,
      action: "OK opens Bake Shop",
    });
  });

  it("Home with the ring on a paused game: its paused chip and where it stopped", () => {
    const s = session({
      focus: "game:rocket-crew",
      suspended: [{ appId: "rocket-crew", instanceId: "r", label: "Mission 6", at: NOW - MIN }],
    });
    expect(mirror(s)).toMatchObject({
      game: rocket,
      title: "Rocket Crew",
      chip: "Paused just now",
      resume: "Mission 6",
      action: "OK continues Rocket Crew",
    });
  });

  it("the latest sitting of a game is the one the chip reads", () => {
    const s = session({
      focus: "game:rocket-crew",
      suspended: [
        { appId: "rocket-crew", instanceId: "a", label: "Mission 2", at: NOW - 3 * 24 * 60 * MIN },
        { appId: "rocket-crew", instanceId: "b", label: "Mission 6", at: NOW - MIN },
      ],
    });
    expect(mirror(s)).toMatchObject({ chip: "Paused just now", resume: "Mission 6" });
  });

  it("Home with the ring on a sitting card: that game, continued", () => {
    const s = session({
      focus: playItem("bake-shop", "b1"),
      suspended: [
        {
          appId: "bake-shop",
          instanceId: "b1",
          label: "Day 4",
          at: new Date(2026, 9, 1).getTime(),
        },
      ],
    });
    expect(mirror(s)).toMatchObject({
      kind: "home",
      game: bake,
      title: "Bake Shop",
      chip: "Paused Thursday",
      resume: "Day 4",
      action: "OK continues Bake Shop",
    });
  });

  it("Home with the ring on a play item (the protocol's card id): that sitting, or Surprise me's pick", () => {
    const s = session({
      focus: playItem("bake-shop", "b1"),
      suspended: [{ appId: "bake-shop", instanceId: "b1", label: "Day 4", at: NOW - MIN }],
    });
    expect(mirror(s)).toMatchObject({
      game: bake,
      chip: "Paused just now",
      resume: "Day 4",
      action: "OK continues Bake Shop",
    });
    // Surprise me's card carries the launcher's hidden pick: the phone keeps the surprise too.
    expect(mirror(session({ focus: playItem("rocket-crew") }))).toMatchObject({
      kind: "surprise",
      game: null,
      title: "Surprise me",
      action: "OK picks a game for the kids",
    });
  });

  it("Home with the ring on Surprise me: the kids' games, OK picks one", () => {
    expect(mirror(session({ focus: playItem("bake-shop") }))).toEqual({
      kind: "surprise",
      game: null,
      title: "Surprise me",
      chip: null,
      resume: null,
      action: "OK picks a game for the kids",
      kids: [rocket, bake],
    });
  });

  it("Home with no focus but a paused game: that game, waiting", () => {
    const s = session({
      suspended: [{ appId: "bake-shop", instanceId: "b", label: "", at: NOW - 10 * MIN }],
    });
    expect(mirror(s)).toMatchObject({
      kind: "home",
      game: bake,
      title: "Bake Shop",
      chip: "Paused at 7:50",
      resume: null,
      action: "Pick a game with the arrows",
    });
  });

  it("a game unknown to the library still names itself by appId, with no art", () => {
    expect(mirror(session({ focus: "game:mystery" }))).toMatchObject({
      game: null,
      title: "mystery",
      action: "OK opens mystery",
    });
  });

  it("the game's page: OK plays (continues when it's paused)", () => {
    expect(mirror(session({ screen: "game-page", page: "word-duel" }))).toMatchObject({
      kind: "page",
      game: duel,
      title: "Word Duel",
      action: "OK starts Word Duel",
    });
    const paused = session({
      screen: "game-page",
      page: "rocket-crew",
      suspended: [{ appId: "rocket-crew", instanceId: "r", label: "Mission 6", at: NOW - MIN }],
    });
    expect(mirror(paused)).toMatchObject({
      chip: "Paused just now",
      resume: "Mission 6",
      action: "OK continues Rocket Crew",
    });
  });

  it("the game's page with Start game focused: OK starts it over", () => {
    const s = session({
      screen: "game-page",
      page: "rocket-crew",
      focus: "action:new",
      suspended: [{ appId: "rocket-crew", instanceId: "r", label: "Mission 6", at: NOW - MIN }],
    });
    expect(mirror(s)).toMatchObject({ action: "OK starts a new game" });
  });

  it("a game playing: Playing now and its own label", () => {
    const s = session({
      screen: "game",
      current: {
        appId: "rocket-crew",
        instanceId: "r",
        mode: "continue",
        roster: [],
        label: "Mission 7",
        startedAt: NOW,
        viewUrl: null,
        hostDeviceId: null,
      },
    });
    expect(mirror(s)).toMatchObject({
      kind: "game",
      game: rocket,
      title: "Rocket Crew",
      chip: "Playing now",
      resume: "Mission 7",
      action: "Home pauses it and shows the games",
    });
  });
});
