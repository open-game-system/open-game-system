import type { SuspendedGame } from "@open-game-system/ogs-protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_GAMES, fixtureInstances } from "../session/fixture";
import {
  buildHome,
  forKids,
  type HomeModel,
  homeFocusRows,
  homeMove,
  iconArt,
  recoverFocus,
  roomArt,
} from "./home";

const NOW = new Date(2026, 9, 3, 19, 10).getTime(); // a Saturday, 7:10 pm
const suspended: SuspendedGame[] = [
  { appId: "rocket-crew", instanceId: "rc-1", label: "Mission 6", at: NOW - 60_000 },
  {
    appId: "bake-shop",
    instanceId: "bs-1",
    label: "Day 4",
    at: new Date(2026, 8, 29, 18).getTime(),
  },
];
const kit = (appId: string) => ({
  tile: `/art/${appId}/tv.jpg`,
  hero: `/art/${appId}/alt.jpg`,
  icon: `/art/${appId}/icon.png`,
  logo: `/art/${appId}/logo.png`,
  heroClean: `/art/${appId}/hero-clean.jpg`,
  cover: `/art/${appId}/cover.jpg`,
});

describe("home: a row of game icons, the room, activity cards", () => {
  // Built per test, not at collection: a throw while collecting skips the file silently under Stryker.
  let home: HomeModel;
  beforeEach(() => {
    home = buildHome({
      games: FIXTURE_GAMES,
      instances: fixtureInstances(NOW),
      suspended,
      now: NOW,
    });
  });

  it("lists every TV game once as an icon, paused sittings first (Continue order)", () => {
    expect(home.icons.map((i) => i.appId)).toEqual([
      "rocket-crew",
      "bake-shop",
      "story-nook",
      "hearthisle",
      "peekaboo-garden",
      "night-flight",
    ]);
    expect(home.icons.map((i) => i.itemId)[0]).toBe("game:rocket-crew");
  });

  it("gives each icon its status and resume point", () => {
    const rc = home.icons[0];
    expect([rc?.tag, rc?.resume]).toEqual(["Paused just now", "Mission 6"]);
    const pg = home.icons.find((i) => i.appId === "peekaboo-garden");
    expect([pg?.tag, pg?.resume]).toEqual(["", "Find who is hiding"]);
  });

  it("puts the latest sitting first, then Surprise me, then the next sitting: three large cards", () => {
    expect(home.cards.map((c) => c.itemId)).toEqual([
      "play:rocket-crew:rc-1",
      "play:bake-shop",
      "play:bake-shop:bs-1",
    ]);
    const first = home.cards[0];
    expect(first?.kind === "sitting" && [first.name, first.tag, first.resume]).toEqual([
      "Rocket Crew",
      "Paused just now",
      "Mission 6",
    ]);
  });

  it("keeps tonight's game night as a card when there is room", () => {
    const h = buildHome({
      games: FIXTURE_GAMES,
      instances: fixtureInstances(NOW),
      suspended: [],
      now: NOW,
    });
    expect(h.cards.map((c) => c.itemId)).toEqual([
      "play:story-nook:story-nook-ember",
      "play:story-nook",
      "play:hearthisle:hearthisle-night",
    ]);
    const night = h.cards[2];
    expect(night?.kind === "sitting" && night.tag).toBe("Tonight at 8:00");
  });

  it("on a fresh evening shows only Surprise me under the icons", () => {
    const h = buildHome({ games: FIXTURE_GAMES, instances: [], suspended: [], now: NOW });
    expect(h.cards.map((c) => c.kind)).toEqual(["surprise"]);
    expect(h.icons).toHaveLength(6);
  });

  it("has no Surprise me without at least two games to pick from", () => {
    const one = FIXTURE_GAMES.slice(0, 1);
    expect(buildHome({ games: one, instances: [], suspended: [], now: NOW }).cards).toEqual([]);
    expect(buildHome({ games: [], instances: [], suspended: [], now: NOW }).icons).toEqual([]);
  });

  it("is two focus rows: icons, then cards", () => {
    const rows = homeFocusRows(home);
    expect(rows.map((r) => r.id)).toEqual(["games", "activity"]);
    expect(rows[0]?.items).toHaveLength(6);
    expect(rows[1]?.items[1]).toBe("play:bake-shop");
    const fresh = buildHome({ games: [], instances: [], suspended: [], now: NOW });
    expect(homeFocusRows(fresh).map((r) => r.items)).toEqual([[], []]);
  });
});

describe("art", () => {
  const base = FIXTURE_GAMES[0];
  if (!base) throw new Error("fixture");
  const safe = { scale: 1.2, ox: 50, oy: 100 };

  it("fills the room with the clean hero and never applies the HUD crop to it", () => {
    expect(roomArt({ ...base, art: { ...kit("x"), safe } })).toEqual({
      src: "/art/x/hero-clean.jpg",
    });
  });
  it("falls back to the captured hero (with its HUD crop) without a kit", () => {
    expect(roomArt({ ...base, art: { tile: "/t.jpg", hero: "/h.jpg", safe } })).toEqual({
      src: "/h.jpg",
      safe,
      captured: true,
    });
    expect(roomArt({ ...base, art: { tile: "/t.jpg" } })).toEqual({
      src: "/t.jpg",
      captured: true,
    });
  });
  it("uses the square icon, or the cropped tile without one", () => {
    expect(iconArt({ ...base, art: { ...kit("x"), safe } })).toEqual({ src: "/art/x/icon.png" });
    expect(iconArt({ ...base, art: { tile: "/t.jpg", safe } })).toEqual({
      src: "/t.jpg",
      safe,
      captured: true,
    });
  });
});

describe("recoverFocus", () => {
  const rows = [
    { id: "games", items: ["game:a", "game:b"] },
    { id: "activity", items: ["game:~surprise"] },
  ];
  it("keeps a focus that is on screen", () => {
    expect(recoverFocus(rows, "game:b", null)).toBeNull();
  });
  it("comes back to the game whose page was open", () => {
    expect(recoverFocus(rows, "action:new", "b")).toBe("game:b");
  });
  it("falls back to the first icon", () => {
    expect(recoverFocus(rows, null, null)).toBe("game:a");
    expect(recoverFocus(rows, "action:new", "gone")).toBe("game:a");
  });
});

describe("homeMove: the remote between the icon row and the cards", () => {
  const rows = [
    { id: "games", items: ["game:a", "game:b", "game:c", "game:d"] },
    { id: "activity", items: ["game:~continue:a:1", "game:~surprise"] },
  ];
  it("goes down to the first card (the latest sitting), whichever icon is focused", () => {
    expect(homeMove(rows, "game:d", "down", null)).toBe("game:~continue:a:1");
  });
  it("goes back up to the icon it came from", () => {
    expect(homeMove(rows, "game:~surprise", "up", "game:d")).toBe("game:d");
  });
  it("goes up to the first icon when it remembers none", () => {
    expect(homeMove(rows, "game:~surprise", "up", null)).toBe("game:a");
    expect(homeMove(rows, "game:~surprise", "up", "game:gone")).toBe("game:a");
  });
  it("moves along a row like the focus grid, and goes nowhere past the ends", () => {
    expect(homeMove(rows, "game:b", "right", null)).toBe("game:c");
    expect(homeMove(rows, "game:a", "left", null)).toBe("game:a");
    expect(homeMove(rows, "game:a", "up", null)).toBe("game:a");
    expect(homeMove(rows, "game:~surprise", "down", null)).toBe("game:~surprise");
  });
  it("goes nowhere down when there are no cards", () => {
    const bare = [rows[0] ?? { id: "games", items: [] }, { id: "activity", items: [] }];
    expect(homeMove(bare, "game:b", "down", null)).toBe("game:b");
  });
});

describe("for the kids", () => {
  const base = FIXTURE_GAMES[0];
  if (!base) throw new Error("fixture");
  it("reads a game as kid-friendly from its shop ages (5 and under), or when it says none", () => {
    expect(forKids({ ...base, shop: { ages: "2+" } })).toBe(true);
    expect(forKids({ ...base, shop: { ages: "5+" } })).toBe(true);
    expect(forKids({ ...base, shop: { ages: "10+" } })).toBe(false);
    expect(forKids({ ...base, shop: {} })).toBe(true);
  });
  it("Surprise me starts this visit's pick: a kids' game, never the one just played", () => {
    const pickWith = (surpriseSeed: number, recent: SuspendedGame[] = suspended) => {
      const h = buildHome({
        games: FIXTURE_GAMES,
        instances: [],
        suspended: recent,
        now: NOW,
        surpriseSeed,
      });
      const card = h.cards.find((c) => c.kind === "surprise");
      return card?.kind === "surprise" ? [card.appId, card.itemId] : null;
    };
    expect(pickWith(0)).toEqual(["bake-shop", "play:bake-shop"]);
    expect(pickWith(0.99)).toEqual(["night-flight", "play:night-flight"]);
    expect(pickWith(0, [])).toEqual(["rocket-crew", "play:rocket-crew"]);
  });
  it("gives Surprise me its own picture and room, not a collage of the games", () => {
    const h = buildHome({ games: FIXTURE_GAMES, instances: [], suspended: [], now: NOW });
    const card = h.cards.find((c) => c.kind === "surprise");
    expect(card?.kind === "surprise" && [card.art, card.room]).toEqual([
      { src: "/art/surprise/card.jpg" },
      { src: "/art/surprise/room.jpg" },
    ]);
  });
  it("lets Surprise me pick only kid-friendly games", () => {
    const games = FIXTURE_GAMES.map((g) =>
      g.appId === "hearthisle" ? { ...g, shop: { ages: "10+" } } : g,
    );
    const h = buildHome({ games, instances: [], suspended: [], now: NOW });
    const surprise = h.cards.find((c) => c.kind === "surprise");
    expect(surprise?.kind === "surprise" && surprise.pool).not.toContain("hearthisle");
    expect(surprise?.kind === "surprise" && surprise.pool).toHaveLength(5);
  });
  it("marks tonight's game night as upcoming, not a sitting to continue", () => {
    const h = buildHome({
      games: FIXTURE_GAMES,
      instances: fixtureInstances(NOW),
      suspended: [],
      now: NOW,
    });
    const kinds = h.cards.map((c) => (c.kind === "sitting" ? c.upcoming : c.kind));
    expect(kinds).toEqual([false, "surprise", true]);
  });
});

describe("home, in detail", () => {
  const base = FIXTURE_GAMES[0];
  if (!base) throw new Error("fixture");

  it("counts ages that don't start with a number as not saying (kid-friendly)", () => {
    expect(forKids({ ...base, shop: { ages: "Ages 10+" } })).toBe(true);
  });

  it("gives each icon its logo, or none", () => {
    const noLogo = { ...base, appId: "plain", art: { tile: "/art/plain/tv.jpg" } };
    const h = buildHome({ games: [base, noLogo], instances: [], suspended: [], now: NOW });
    expect(h.icons.map((i) => i.logo)).toEqual([`/art/${base.appId}/logo.png`, null]);
  });

  it("Surprise me needs exactly two kid-friendly games, and shows and picks from them", () => {
    const two = FIXTURE_GAMES.slice(0, 2);
    const h = buildHome({ games: two, instances: [], suspended: [], now: NOW });
    const surprise = h.cards.find((c) => c.kind === "surprise");
    expect(surprise?.kind === "surprise" && surprise.pool).toEqual(two.map((g) => g.appId));
    expect(surprise?.kind === "surprise" && surprise.icons).toEqual(h.icons.map((i) => i.icon));
  });

  it("the icon row's focus items are the icons' item ids", () => {
    const h = buildHome({ games: FIXTURE_GAMES, instances: [], suspended: [], now: NOW });
    expect(homeFocusRows(h)[0]?.items).toEqual(h.icons.map((i) => i.itemId));
  });

  it("an unknown focus recovers like the focus grid, and a home with no card row stays put", () => {
    const rows = [{ id: "games", items: ["game:a", "game:b"] }];
    expect(homeMove(rows, "game:gone", "down", null)).toBe("game:a");
    expect(homeMove(rows, "game:a", "down", null)).toBe("game:a");
  });
});

describe("homeMove: an empty icon row", () => {
  it("keeps the focus on the card when there is no icon to go up to", () => {
    const rows = [
      { id: "games", items: [] },
      { id: "activity", items: ["game:~surprise"] },
    ];
    expect(homeMove(rows, "game:~surprise", "up", "game:gone")).toBe("game:~surprise");
  });
});
