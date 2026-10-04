import {
  type Instance,
  initialSession,
  type Manifest,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import { heroEyebrow, libraryShelves } from "../shelves";

const MIN = 60 * 1000;
const H = 60 * MIN;
const DAY = 24 * H;
const NOW = 100 * DAY;

const game = (appId: string): Manifest => ({
  appId,
  name: appId,
  tagline: "",
  shape: "couch",
  tv: "required",
  startUrl: `https://${appId}.example/`,
  tvUrl: `https://${appId}.example/tv`,
  roles: [],
  art: { tile: "/t.jpg" },
  shop: {},
  instanceTtlMs: 7 * DAY,
});

const inst = (appId: string, ago: number, patch: Partial<Instance> = {}): Instance => ({
  instanceId: `${appId}-${ago}`,
  appId,
  profileId: "pr1",
  status: "suspended",
  title: "",
  detail: "",
  updatedAt: NOW - ago,
  source: "bridge",
  ...patch,
});

const session = (patch: Partial<SessionState>): SessionState => ({
  ...initialSession("s1", "pr1"),
  ...patch,
});

const ids = (games: Manifest[]) => games.map((g) => g.appId);
const library = ["a", "b", "c", "d", "e"].map(game);

describe("libraryShelves: the Library's hero and All Games", () => {
  it("is empty for an empty library", () => {
    expect(libraryShelves([], [], null, NOW)).toEqual({ hero: null, all: [] });
  });

  it("first run: the first game is the hero with nothing to rejoin; All Games keeps library order", () => {
    const shelves = libraryShelves(library, [], null, NOW);
    expect(shelves.hero?.game.appId).toBe("a");
    expect(shelves.hero?.sitting).toBeNull();
    expect(shelves.hero?.playedAt).toBeNull();
    expect(ids(shelves.all)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("the most recently played game is the hero, with its newest sitting to rejoin", () => {
    const shelves = libraryShelves(
      library,
      [inst("c", 2 * H), inst("c", 3 * DAY), inst("d", DAY)],
      null,
      NOW,
    );
    expect(shelves.hero?.game.appId).toBe("c");
    expect(shelves.hero?.sitting?.instanceId).toBe(`c-${2 * H}`);
    expect(shelves.hero?.playedAt).toBe(NOW - 2 * H);
  });

  it("All Games lists every game once: played newest first, then the rest in library order", () => {
    const shelves = libraryShelves(
      library,
      [inst("e", 5 * H), inst("b", H), inst("a", 2 * DAY), inst("d", 3 * H)],
      null,
      NOW,
    );
    expect(shelves.hero?.game.appId).toBe("b");
    expect(ids(shelves.all)).toEqual(["b", "d", "e", "a", "c"]);
  });

  it("a finished game still counts as played (hero without a sitting: Start game)", () => {
    const shelves = libraryShelves(library, [inst("d", H, { status: "completed" })], null, NOW);
    expect(shelves.hero?.game.appId).toBe("d");
    expect(shelves.hero?.sitting).toBeNull();
    expect(shelves.hero?.playedAt).toBe(NOW - H);
  });

  it("the game live on the TV is the hero (and first in All Games) even when another was touched later", () => {
    const live = session({
      current: {
        appId: "e",
        instanceId: "e-live",
        mode: "new",
        roster: [],
        label: "Level 3",
        startedAt: NOW - 30 * MIN,
        viewUrl: null,
        hostDeviceId: null,
      },
    });
    const shelves = libraryShelves(library, [inst("a", MIN)], live, NOW);
    expect(shelves.hero?.game.appId).toBe("e");
    expect(shelves.hero?.sitting?.live).toBe(true);
    expect(ids(shelves.all)).toEqual(["e", "a", "b", "c", "d"]);
  });

  it("a game paused on the couch session counts as played at its pause time", () => {
    const paused = session({
      suspended: [{ appId: "d", instanceId: "d-9", label: "Wave 2", at: NOW - 10 * MIN }],
    });
    const shelves = libraryShelves(library, [inst("a", H)], paused, NOW);
    expect(shelves.hero?.game.appId).toBe("d");
    expect(shelves.hero?.playedAt).toBe(NOW - 10 * MIN);
    expect(shelves.hero?.sitting?.label).toBe("Wave 2");
    expect(ids(shelves.all)).toEqual(["d", "a", "b", "c", "e"]);
  });

  it("ignores instances and sessions of games not in the library", () => {
    const shelves = libraryShelves(library.slice(0, 2), [inst("zzz", MIN)], null, NOW);
    expect(shelves.hero?.game.appId).toBe("a");
    expect(ids(shelves.all)).toEqual(["a", "b"]);
  });

  it("scales to 30 games: every game once, newest played first", () => {
    const many = Array.from({ length: 30 }, (_, i) => game(`g${i}`));
    // Only the even games were played; higher index = more recent.
    const played = many.filter((_, i) => i % 2 === 0).map((g, k) => inst(g.appId, (30 - k) * H));
    const shelves = libraryShelves(many, played, null, NOW);
    expect(shelves.hero?.game.appId).toBe("g28");
    expect(shelves.all).toHaveLength(30);
    expect(new Set(ids(shelves.all)).size).toBe(30);
    expect(ids(shelves.all).slice(0, 3)).toEqual(["g28", "g26", "g24"]);
    expect(ids(shelves.all).slice(15, 18)).toEqual(["g1", "g3", "g5"]);
  });
});

describe("heroEyebrow: the line above the hero's name", () => {
  const hero = (patch: Partial<NonNullable<ReturnType<typeof libraryShelves>["hero"]>>) => ({
    game: game("a"),
    sitting: null,
    playedAt: null,
    ...patch,
  });
  const sitting = (live: boolean, label: string) => ({
    instanceId: "a-1",
    label,
    at: NOW - H,
    resumeUrl: undefined,
    live,
  });

  it("is nothing for a game never played", () => {
    expect(heroEyebrow(hero({}), NOW)).toBeNull();
  });
  it("says when it was last played", () => {
    expect(heroEyebrow(hero({ playedAt: NOW - 2 * H }), NOW)).toBe("Played 2 hours ago");
    expect(heroEyebrow(hero({ playedAt: NOW - 30 * H }), NOW)).toBe("Played yesterday");
  });
  it("names the resume point when the game gave one", () => {
    expect(heroEyebrow(hero({ playedAt: NOW - H, sitting: sitting(false, "Level 3") }), NOW)).toBe(
      "Level 3",
    );
  });
  it("says the game is on the TV now when it's live", () => {
    expect(heroEyebrow(hero({ playedAt: NOW, sitting: sitting(true, "Level 3") }), NOW)).toBe(
      "On the TV now",
    );
  });
});
