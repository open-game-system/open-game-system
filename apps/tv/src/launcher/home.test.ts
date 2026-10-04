import type { SuspendedGame } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { FIXTURE_GAMES, fixtureInstances } from "../session/fixture";
import { buildHome, homeFocusRows, iconArt, recoverFocus, roomArt } from "./home";
import { SURPRISE_ITEM } from "./shortcuts";

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
  const home = buildHome({
    games: FIXTURE_GAMES,
    instances: fixtureInstances(NOW),
    suspended,
    now: NOW,
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

  it("puts the sittings (paused, then tonight) on cards that continue that sitting, then Surprise me", () => {
    expect(home.cards.map((c) => c.itemId)).toEqual([
      "game:~continue:rocket-crew:rc-1",
      "game:~continue:bake-shop:bs-1",
      "game:~continue:story-nook:story-nook-ember",
      SURPRISE_ITEM,
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
      "game:~continue:story-nook:story-nook-ember",
      "game:~continue:hearthisle:hearthisle-night",
      SURPRISE_ITEM,
    ]);
    const night = h.cards[1];
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
    expect(rows[1]?.items.at(-1)).toBe(SURPRISE_ITEM);
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
    });
    expect(roomArt({ ...base, art: { tile: "/t.jpg" } })).toEqual({ src: "/t.jpg" });
  });
  it("uses the square icon, or the cropped tile without one", () => {
    expect(iconArt({ ...base, art: { ...kit("x"), safe } })).toEqual({ src: "/art/x/icon.png" });
    expect(iconArt({ ...base, art: { tile: "/t.jpg", safe } })).toEqual({ src: "/t.jpg", safe });
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
