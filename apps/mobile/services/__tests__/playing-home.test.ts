import type { Instance, Manifest } from "@open-game-system/ogs-protocol";
import {
  asSitting,
  gameFacts,
  groupNote,
  heroSitting,
  liveHeadline,
  liveMeta,
  liveVerb,
  sharedLine,
  sittingRow,
  sittingRows,
  startedBy,
  whatToStart,
} from "../playing-home";

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const NOW = 100 * DAY;

const game = (appId: string, tv: Manifest["tv"] = "required"): Manifest => ({
  appId,
  name: appId.replace(/-/g, " "),
  tagline: `${appId} tagline`,
  shape: "couch",
  tv,
  startUrl: `https://${appId}.example/`,
  tvUrl: tv === "none" ? undefined : `https://${appId}.example/tv`,
  roles: [],
  art: { tile: "/t.jpg" },
  shop: {},
  instanceTtlMs: 7 * DAY,
});

const inst = (appId: string, patch: Partial<Instance> = {}): Instance => ({
  instanceId: `${appId}-1`,
  appId,
  profileId: "pr1",
  status: "suspended",
  title: "",
  detail: "",
  updatedAt: NOW - MIN * 5,
  source: "bridge",
  ...patch,
});

const base = {
  status: "ready" as const,
  error: null,
  catalogue: [] as Manifest[],
  instances: [] as Instance[],
  cast: false,
  tvName: null,
  now: NOW,
};

describe("Playing with nothing in progress", () => {
  it("never promises suggestions while the games are still loading", () => {
    expect(whatToStart({ ...base, status: "loading", library: [] }).kind).toBe("loading");
    expect(whatToStart({ ...base, status: "idle", library: [] }).kind).toBe("loading");
  });

  it("says OGS can't be reached (with a retry) when the games failed to load", () => {
    // Root cause of the bare "Start something tonight:": a failed refresh leaves the library
    // empty and the screen still promised suggestions.
    const error = {
      text: "Can't reach OGS. Check your Wi-Fi and try again.",
      action: "retry" as const,
    };
    const view = whatToStart({ ...base, status: "offline", error, library: [] });
    expect(view).toEqual({ kind: "offline", error });
  });

  it("offline with games already loaded keeps suggesting them", () => {
    const view = whatToStart({ ...base, status: "offline", library: [game("rocket-crew")] });
    expect(view.kind).toBe("suggest");
  });

  it("an empty library sends you to Library to add games instead of an empty promise", () => {
    expect(whatToStart({ ...base, library: [] }).kind).toBe("noGames");
  });

  it("an empty library still suggests catalogue games once loaded, so there's never a dead end", () => {
    const view = whatToStart({ ...base, library: [], catalogue: [game("bake-shop")] });
    expect(view.kind).toBe("suggest");
    if (view.kind !== "suggest") return;
    expect(view.picks.map((p) => p.game.appId)).toEqual(["bake-shop"]);
  });

  it("suggests the library: last played first, then what fits the moment", () => {
    const library = [game("rocket-crew"), game("word-duel", "none"), game("bake-shop")];
    const instances = [inst("bake-shop", { status: "completed", updatedAt: NOW - DAY - MIN })];
    const view = whatToStart({ ...base, library, instances });
    expect(view.kind).toBe("suggest");
    if (view.kind !== "suggest") return;
    expect(view.picks.map((p) => p.game.appId)).toEqual(["bake-shop", "word-duel", "rocket-crew"]);
    expect(view.picks[0].why).toBe("Played yesterday");
  });

  it("says where each pick plays", () => {
    const library = [
      game("rocket-crew"),
      game("word-duel", "none"),
      game("hearthisle", "optional"),
    ];
    const view = whatToStart({ ...base, library });
    if (view.kind !== "suggest") throw new Error(view.kind);
    const why = Object.fromEntries(view.picks.map((p) => [p.game.appId, p.why]));
    expect(why).toEqual({
      // Owner, 2026-10-04: no "Casts to the TV first"; Play asks to cast when it must.
      "rocket-crew": "Plays on the TV",
      "word-duel": "Plays on this phone",
      hearthisle: "TV or this phone",
    });
  });

  it("not cast: Cast to TV is offered when any suggestion can use the TV", () => {
    const view = whatToStart({ ...base, library: [game("rocket-crew")] });
    if (view.kind !== "suggest") throw new Error(view.kind);
    expect(view.offerCast).toBe(true);
    expect(view.lead).toBe("Nothing in progress");
    expect(view.sub).toBe("Cast to the TV, then pick a game to start together.");
  });

  it("not cast with phone games too: says both ways to start", () => {
    const view = whatToStart({
      ...base,
      library: [game("rocket-crew"), game("word-duel", "none")],
    });
    if (view.kind !== "suggest") throw new Error(view.kind);
    expect(view.sub).toBe("Cast to the TV to play together, or start a game on this phone.");
  });

  it("phone games only: no Cast to TV", () => {
    const view = whatToStart({ ...base, library: [game("word-duel", "none")] });
    if (view.kind !== "suggest") throw new Error(view.kind);
    expect(view.offerCast).toBe(false);
    expect(view.sub).toBe("Pick a game to start on this phone.");
  });

  it("cast: no Cast button, the TV is named and ready, TV games first", () => {
    const library = [game("word-duel", "none"), game("rocket-crew")];
    const view = whatToStart({ ...base, cast: true, tvName: "Living room TV", library });
    if (view.kind !== "suggest") throw new Error(view.kind);
    expect(view.offerCast).toBe(false);
    expect(view.sub).toBe("Living room TV is ready. Pick a game to start on it.");
    expect(view.picks.map((p) => p.game.appId)).toEqual(["rocket-crew", "word-duel"]);
    expect(view.picks[0].why).toBe("Starts on the TV");
  });

  it("cast with an unnamed TV", () => {
    const view = whatToStart({ ...base, cast: true, library: [game("rocket-crew")] });
    if (view.kind !== "suggest") throw new Error(view.kind);
    expect(view.sub).toBe("The TV is ready. Pick a game to start on it.");
  });

  it("while a game is live, a TV pick says it pauses that game", () => {
    const library = [game("bake-shop"), game("word-duel", "none")];
    const view = whatToStart({ ...base, cast: true, liveName: "Rocket Crew", library });
    if (view.kind !== "suggest") throw new Error(view.kind);
    expect(Object.fromEntries(view.picks.map((p) => [p.game.appId, p.why]))).toEqual({
      "bake-shop": "Pauses Rocket Crew",
      "word-duel": "Plays on this phone",
    });
  });

  it("at most four picks", () => {
    const library = ["a", "b", "c", "d", "e", "f"].map((id) => game(id));
    const view = whatToStart({ ...base, library });
    if (view.kind !== "suggest") throw new Error(view.kind);
    expect(view.picks).toHaveLength(4);
  });
});

describe("a sitting's card in Playing", () => {
  const rc = game("rocket-crew");
  // OGS mints sitting ids as <appId>-<start time base 36>; the game page reads the start back.
  const started = NOW - 3 * 60 * MIN;
  const minted = `rocket-crew-${started.toString(36)}`;
  const clock = (t: number) => {
    const d = new Date(t);
    const h = d.getHours();
    return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };

  it("the game as the eyebrow, its resume point as the headline, when as the meta", () => {
    expect(sittingRow(inst("rocket-crew", { title: "Mission 6" }), rc, NOW)).toEqual({
      name: "rocket crew",
      headline: "Mission 6",
      meta: "Played 5 min ago",
      playsOn: "tv",
      where: "On the TV",
      asks: false,
      named: true,
    });
  });

  it("named by when it started when the game never said where you are, never a status word", () => {
    const row = sittingRow(inst("rocket-crew", { instanceId: minted }), rc, NOW);
    expect(row.headline).toBe(`Started ${clock(started)}`);
    expect(row.named).toBe(false);
    expect(sittingRow(inst("rocket-crew", { title: "Mission 6" }), rc, NOW).named).toBe(true);
    expect(row.headline).not.toMatch(/In progress/);
  });

  it("a visit's title is only the game's name, so it isn't repeated", () => {
    const visit = inst("rocket-crew", {
      instanceId: minted,
      source: "visit",
      title: "Rocket Crew",
    });
    expect(sittingRow(visit, rc, NOW).headline).toBe(`Started ${clock(started)}`);
  });

  it("falls back to the detail when there is no title", () => {
    expect(sittingRow(inst("rocket-crew", { detail: "Day 4" }), rc, NOW).headline).toBe("Day 4");
  });

  it("whose turn it is comes from its section, not the card", () => {
    const duel = game("word-duel", "none");
    const mine = inst("word-duel", { status: "waiting", yourTurn: true, title: "vs Nana" });
    expect(sittingRow(mine, duel, NOW)).toEqual({
      name: "word duel",
      headline: "vs Nana",
      meta: "Played 5 min ago",
      playsOn: "phone",
      where: "On this phone",
      asks: false,
      named: true,
    });
  });

  it("a game the catalogue no longer has still reads by its id", () => {
    expect(sittingRow(inst("gone-game", { title: "Level 2" }), undefined, NOW)).toMatchObject({
      name: "gone-game",
      headline: "Level 2",
      playsOn: "either",
    });
  });

  // Owner, 2026-10-04: Rejoin asks to cast when it must, so a row says where the game plays, not
  // "Casts to the TV first"; a game that plays either way is offered both by the cast prompt.
  it("says where Rejoin will land: the TV for TV games, this phone for phone games", () => {
    const where = (g: Manifest, cast: boolean) => sittingRow(inst(g.appId), g, NOW, cast).where;
    expect(where(rc, false)).toBe("On the TV");
    expect(where(rc, true)).toBe("On the TV");
    expect(where(game("hearthisle", "optional"), true)).toBe("On the TV");
    expect(where(game("hearthisle", "optional"), false)).toBe("TV or this phone");
    expect(where(game("word-duel", "none"), true)).toBe("On this phone");
  });

  it("while another game is live on the TV, a TV sitting says it pauses that game", () => {
    const row = sittingRow(inst("bake-shop"), game("bake-shop"), NOW, true, "Rocket Crew");
    expect(row.where).toBe("Pauses Rocket Crew");
    // Another sitting of the live game swaps sittings rather than games.
    const other = sittingRow(inst("rocket-crew"), game("rocket-crew"), NOW, true, "rocket crew");
    // Every TV sitting says the same thing, so its group can say it once.
    expect(other.where).toBe("Pauses rocket crew");
    // A phone game doesn't touch the TV.
    const duel = sittingRow(inst("word-duel"), game("word-duel", "none"), NOW, true, "Rocket Crew");
    expect(duel.where).toBe("On this phone");
  });

  it("Rejoin always; it asks first only when it would pause the live game for everyone", () => {
    expect(sittingRow(inst("bake-shop"), game("bake-shop"), NOW, true).asks).toBe(false);
    expect(sittingRow(inst("bake-shop"), game("bake-shop"), NOW, true, "Rocket Crew").asks).toBe(
      true,
    );
    const duel = game("word-duel", "none");
    expect(sittingRow(inst("word-duel"), duel, NOW, true, "Rocket Crew").asks).toBe(false);
  });

  it("two sittings of one game that would read alike become Game 1 and Game 2", () => {
    const a = inst("rocket-crew", { instanceId: minted, updatedAt: NOW - MIN });
    const b = inst("rocket-crew", {
      instanceId: `rocket-crew-x${started.toString(36)}`,
      updatedAt: NOW - MIN,
    });
    const rows = sittingRows([a, b], () => rc, NOW, false);
    const heads = [rows.get(a.instanceId)?.headline, rows.get(b.instanceId)?.headline];
    expect(new Set(heads).size).toBe(2);
  });

  it("different games never renumber each other", () => {
    const a = inst("rocket-crew", { title: "Mission 6" });
    const b = inst("bake-shop", { title: "Mission 6" });
    const rows = sittingRows([a, b], (id) => game(id), NOW, false);
    expect(rows.get(a.instanceId)?.headline).toBe("Mission 6");
    expect(rows.get(b.instanceId)?.headline).toBe("Mission 6");
  });
});

describe("the hero: the one sitting Playing leads with", () => {
  const rc = inst("rocket-crew", { instanceId: "rc", updatedAt: NOW - 60 * MIN });
  const bake = inst("bake-shop", { instanceId: "bake", updatedAt: NOW - 5 * MIN });
  const duel = inst("word-duel", {
    instanceId: "duel",
    status: "waiting",
    yourTurn: true,
    updatedAt: NOW - DAY,
  });
  const theirs = inst("word-duel", {
    instanceId: "theirs",
    status: "waiting",
    yourTurn: false,
    updatedAt: NOW - MIN,
  });
  const done = inst("story-nook", { instanceId: "done", status: "completed", updatedAt: NOW });

  it("nothing when nothing is in progress", () => {
    expect(heroSitting([], false)).toBeNull();
    expect(heroSitting([done, theirs], false)).toBeNull();
  });

  it("the game live on the TV wins (the screen pins it itself)", () => {
    expect(heroSitting([rc, bake, duel], true)).toBeNull();
  });

  it("else your turn comes first", () => {
    expect(heroSitting([rc, bake, duel], false)?.instanceId).toBe("duel");
  });

  it("else the most recently played sitting", () => {
    expect(heroSitting([rc, bake, theirs, done], false)?.instanceId).toBe("bake");
  });
});

describe("a pick's facts", () => {
  it("players and minutes from the game's shop facts", () => {
    const g = {
      ...game("bake-shop"),
      shop: { players: "2-4", minutes: [10, 25] as [number, number] },
    };
    expect(gameFacts(g)).toBe("2–4 players · 10–25 min");
  });

  it("one player, a single length, or nothing known", () => {
    expect(
      gameFacts({ ...game("a"), shop: { players: "1", minutes: [15, 15] as [number, number] } }),
    ).toBe("1 player · 15 min");
    expect(gameFacts(game("b"))).toBe("");
  });
});

describe("what to start while other sittings are in progress", () => {
  it("leaves out games you're already in, so it only offers something new", () => {
    const library = [game("rocket-crew"), game("bake-shop"), game("story-nook")];
    const view = whatToStart({ ...base, library, exclude: ["rocket-crew"] });
    if (view.kind !== "suggest") throw new Error(view.kind);
    expect(view.picks.map((p) => p.game.appId)).toEqual(["bake-shop", "story-nook"]);
  });

  it("nothing left to suggest is still a suggestion with no picks, not an error", () => {
    const view = whatToStart({ ...base, library: [game("rocket-crew")], exclude: ["rocket-crew"] });
    expect(view.kind).toBe("suggest");
    if (view.kind !== "suggest") return;
    expect(view.picks).toEqual([]);
  });
});

describe("the game live on the TV", () => {
  it("its resume point, else when it started (never In progress)", () => {
    const startedAt = NOW - 20 * MIN;
    const live = {
      appId: "rocket-crew",
      instanceId: `rocket-crew-${startedAt.toString(36)}`,
      label: "",
      startedAt,
    };
    expect(liveHeadline(live, NOW)).toMatch(/^Started \d{1,2}:\d{2} (AM|PM)$/);
    expect(liveHeadline({ ...live, label: "Mission 6" }, NOW)).toBe("Mission 6");
  });
});

describe("a line every card in a group would repeat", () => {
  it("is said once for the group", () => {
    expect(sharedLine(["Casts to the TV first", "Casts to the TV first"])).toBe(
      "Casts to the TV first",
    );
  });
  it("one card, or cards that differ, keep their own", () => {
    expect(sharedLine(["Casts to the TV first"])).toBeNull();
    expect(sharedLine(["On this phone", "Casts to the TV first"])).toBeNull();
    expect(sharedLine([])).toBeNull();
  });
});

describe("a group's note about the TV", () => {
  it("says once what starting one does to the live game", () => {
    expect(groupNote("Pauses Rocket Crew")).toBe("Starting one pauses Rocket Crew for everyone");
  });
  it("other shared lines read as they are; none, nothing", () => {
    expect(groupNote("Casts to the TV first")).toBe("Casts to the TV first");
    expect(groupNote(null)).toBeNull();
  });
});

describe("the live game's second line", () => {
  it("who started it, once", () => {
    expect(liveMeta("Mom")).toBe("Mom started it");
    expect(liveMeta("You")).toBe("You started it");
    expect(liveMeta(null)).toBeNull();
  });
});

describe("the live game's button", () => {
  it("Rejoin when you started it (or nobody knows), Join when someone else did", () => {
    expect(liveVerb("You")).toBe("Rejoin");
    expect(liveVerb(null)).toBe("Rejoin");
    expect(liveVerb("Mom")).toBe("Join");
  });
});

describe("who started the live game", () => {
  const state = {
    members: [
      { profileId: "p-dad", name: "Jonathan", sticker: "bear" },
      { profileId: "p-mom", name: "Mom", sticker: "owl" },
    ],
    devices: [
      { deviceId: "dad-phone", kind: "phone" as const, profileId: "p-dad", online: true },
      { deviceId: "mom-phone", kind: "phone" as const, profileId: "p-mom", online: true },
    ],
  };
  it("another member by name, this phone as You, unknown as nothing", () => {
    expect(startedBy(state, "mom-phone", "dad-phone")).toBe("Mom");
    expect(startedBy(state, "dad-phone", "dad-phone")).toBe("You");
    expect(startedBy(state, "kid-ipad", "dad-phone")).toBeNull();
    expect(startedBy(state, null, "dad-phone")).toBeNull();
  });
});

describe("an instance as a sitting to rejoin", () => {
  it("keeps its id and resume URL", () => {
    const i = inst("rocket-crew", { resumeUrl: "https://rc.example/r/ABCD" });
    expect(asSitting(i)).toMatchObject({
      instanceId: i.instanceId,
      resumeUrl: "https://rc.example/r/ABCD",
    });
  });
});
