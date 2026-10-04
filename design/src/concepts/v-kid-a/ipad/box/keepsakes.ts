// What lives in a child's toy box: one or two keepsakes from every game they have a seat in
// (a kid role for Juneau, a "little" role for Ava). They come from the games' own art (Bake Shop's
// plush customers, Story Nook's paper stickers) or are drawn in the game's palette (a ringed planet
// from Rocket Crew, a cupcake from Bake Shop). No faces on objects; critters keep the faces their
// game painted. Adding a game adds its keepsakes here by game id: the box itself never changes.
import { GAMES, type GameManifest, type Person } from "../../../../world";

export type KeepsakeKind = "planet" | "medal" | "cupcake" | "donut" | "flower" | "leaf" | "moon" | "feather" | "img";

export interface Keepsake {
  id: string;
  gameId: string;
  kind: KeepsakeKind;
  /** A cut-out from the game's own art (kind "img"). */
  src?: string;
  /** Burst colours when poked: the game's palette. */
  colors: string[];
}

const BY_GAME: Record<string, { kind: KeepsakeKind; src?: string; for: "kid" | "little" | "both" }[]> = {
  "rocket-crew": [{ kind: "planet", for: "kid" }, { kind: "medal", for: "kid" }],
  "bake-shop": [{ kind: "cupcake", for: "both" }, { kind: "img", src: "/art/bake-shop/char-bunny.webp", for: "kid" }, { kind: "img", src: "/art/bake-shop/char-duck.webp", for: "little" }, { kind: "donut", for: "little" }],
  "story-nook": [{ kind: "img", src: "/art/story-nook/char-turtle.webp", for: "both" }, { kind: "img", src: "/art/story-nook/char-firefly.webp", for: "kid" }],
  "peekaboo-garden": [{ kind: "flower", for: "both" }, { kind: "leaf", for: "little" }],
  "night-flight": [{ kind: "moon", for: "kid" }, { kind: "feather", for: "kid" }],
};

const seated = (g: GameManifest, who: Person): boolean =>
  g.shape === "couch" && g.roles.some((r) => (who.band === "little" ? r.audience === "little" : r.audience === "kid"));

/** This child's keepsakes, in the order they fill the floor. Each child's set is their own. */
export function keepsakesFor(who: Person): Keepsake[] {
  const out: Keepsake[] = [];
  for (const g of GAMES) {
    if (!seated(g, who)) continue;
    const list = BY_GAME[g.id] ?? [];
    list.forEach((k, i) => {
      const band = who.band === "little" ? "little" : "kid";
      if (k.for !== "both" && k.for !== band) return;
      out.push({ id: `${g.id}-${i}`, gameId: g.id, kind: k.kind, src: k.src, colors: [g.palette.accent, g.palette.accent2, "#fff6e0"] });
    });
  }
  return out;
}

/**
 * Where keepsakes rest on the floor and wall (centres, iPad points). Kept clear of the box and the
 * character (bottom centre) and of the name tag (top centre). The thumb zones hold the most.
 */
export const SLOTS: { x: number; y: number; r: number }[] = [
  { x: 120, y: 640, r: -10 },
  { x: 1060, y: 640, r: 9 },
  { x: 290, y: 520, r: 6 },
  { x: 890, y: 520, r: -7 },
  { x: 140, y: 360, r: 8 },
  { x: 1050, y: 360, r: -12 },
  { x: 300, y: 300, r: -4 },
  { x: 880, y: 290, r: 5 },
  { x: 130, y: 120, r: -6 },
  { x: 1060, y: 120, r: 11 },
  { x: 350, y: 110, r: 4 },
  { x: 830, y: 110, r: -9 },
];

/** A cheap, fixed shuffle: jumble n moves keepsake i to a different slot every time. */
export function slotOf(i: number, jumble: number): number {
  if (jumble === 0) return i % SLOTS.length;
  const step = [5, 7, 11][jumble % 3] ?? 5;
  return (i * step + jumble * 3) % SLOTS.length;
}
