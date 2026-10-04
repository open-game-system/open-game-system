import {
  type Instance,
  initialSession,
  type Manifest,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import { heroAction, heroEyebrow, libraryShelves } from "../shelves";

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

describe("libraryShelves: the Library's hero and All Games (every game, in a stable order)", () => {
  it("is empty for an empty library", () => {
    expect(libraryShelves([], [], null, NOW)).toEqual({ hero: null, grid: [] });
  });

  it("first run: the first game is the hero with nothing to rejoin; the grid is every game in library order", () => {
    const shelves = libraryShelves(library, [], null, NOW);
    expect(shelves.hero?.game.appId).toBe("a");
    expect(shelves.hero?.sitting).toBeNull();
    expect(shelves.hero?.playedAt).toBeNull();
    expect(ids(shelves.grid)).toEqual(["a", "b", "c", "d", "e"]);
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

  it("the grid keeps library order and every game whatever was played", () => {
    const shelves = libraryShelves(
      library,
      [inst("e", 5 * H), inst("b", H), inst("a", 2 * DAY), inst("d", 3 * H)],
      null,
      NOW,
    );
    expect(shelves.hero?.game.appId).toBe("b");
    expect(ids(shelves.grid)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("a finished game still counts as played (hero without a sitting: Start game)", () => {
    const shelves = libraryShelves(library, [inst("d", H, { status: "completed" })], null, NOW);
    expect(shelves.hero?.game.appId).toBe("d");
    expect(shelves.hero?.sitting).toBeNull();
    expect(shelves.hero?.playedAt).toBe(NOW - H);
  });

  it("the game live on the TV is the hero even when another was touched later", () => {
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
    expect(ids(shelves.grid)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("a game paused on the couch session counts as played at its pause time", () => {
    const paused = session({
      suspended: [{ appId: "d", instanceId: "d-9", label: "Wave 2", at: NOW - 10 * MIN }],
    });
    const shelves = libraryShelves(library, [inst("a", H)], paused, NOW);
    expect(shelves.hero?.game.appId).toBe("d");
    expect(shelves.hero?.playedAt).toBe(NOW - 10 * MIN);
    expect(shelves.hero?.sitting?.label).toBe("Wave 2");
  });

  it("ignores instances and sessions of games not in the library", () => {
    const shelves = libraryShelves(library.slice(0, 2), [inst("zzz", MIN)], null, NOW);
    expect(shelves.hero?.game.appId).toBe("a");
    expect(ids(shelves.grid)).toEqual(["a", "b"]);
  });

  it("scales to 30 games: all 30 in the grid in library order", () => {
    const many = Array.from({ length: 30 }, (_, i) => game(`g${i}`));
    const played = many.filter((_, i) => i % 2 === 0).map((g, k) => inst(g.appId, (30 - k) * H));
    const shelves = libraryShelves(many, played, null, NOW);
    expect(shelves.hero?.game.appId).toBe("g28");
    expect(ids(shelves.grid)).toEqual(ids(many));
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
    expect(heroEyebrow(hero({}))).toBeNull();
  });
  it("is nothing for a game merely played before: Library shows games, not their state", () => {
    expect(heroEyebrow(hero({ playedAt: NOW - 2 * H }))).toBeNull();
  });
  it("names the resume point when the game gave one", () => {
    expect(heroEyebrow(hero({ playedAt: NOW - H, sitting: sitting(false, "Level 3") }))).toBe(
      "Level 3",
    );
  });
  it("says the game is on the TV now when it's live", () => {
    expect(heroEyebrow(hero({ playedAt: NOW, sitting: sitting(true, "Level 3") }))).toBe(
      "On the TV now",
    );
  });
});

describe("heroAction: the hero's one button, never a second Rejoin beside the return pill", () => {
  const hero = (sitting: boolean) => ({
    game: game("a"),
    sitting: sitting
      ? { instanceId: "a-1", label: "", at: NOW - H, resumeUrl: undefined, live: false }
      : null,
    playedAt: sitting ? NOW - H : null,
  });
  const pill = (appId: string | null) => ({ appId, name: "A", url: "https://a.example/", at: NOW });

  it("Start game when there's nothing to rejoin", () => {
    expect(heroAction(hero(false), null)).toBe("start");
    expect(heroAction(hero(false), pill("a"))).toBe("start");
  });
  it("Rejoin when there's a sitting and no pill", () => {
    expect(heroAction(hero(true), null)).toBe("rejoin");
  });
  it("Rejoin when the pill points at another game", () => {
    expect(heroAction(hero(true), pill("b"))).toBe("rejoin");
    expect(heroAction(hero(true), pill(null))).toBe("rejoin");
  });
  it("no button when the pill already rejoins this game", () => {
    expect(heroAction(hero(true), pill("a"))).toBeNull();
  });
});
