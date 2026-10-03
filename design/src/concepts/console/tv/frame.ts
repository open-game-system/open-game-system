// HUD-safe framing for game captures shown inside OGS chrome (home backdrop, shelf, cut-over,
// paused card). Captures carry each game's own HUD (Rocket Crew's top row and its faced planet,
// Bake Shop's corner sign, Peekaboo's star button, Night Flight's turn bar); OGS chrome must never
// collide with it. In the product this is a manifest field (`art.safe`: the HUD-free rectangle of
// the key art); here it is a table keyed by game id, so the TV code stays game-agnostic.
import { gameById } from "../../../world";

export interface Frame {
  src: string;
  /** Zoom applied to the capture (1 = untouched). */
  scale: number;
  /** transform-origin, in % of the capture: where the zoom anchors. */
  ox: number;
  oy: number;
}

interface SafeArt {
  src: "tv" | "alt";
  scale: number;
  ox: number;
  oy: number;
}

const SAFE: Record<string, SafeArt> = {
  // Top row of mission dots + a planet icon with a face (top right): anchor to the bottom, zoom it off.
  "rocket-crew": { src: "tv", scale: 1.17, ox: 50, oy: 100 },
  // "Bake Shop" sign clipped at the top right.
  "bake-shop": { src: "tv", scale: 1.15, ox: 28, oy: 100 },
  // Progress dots top left, star button top right.
  "peekaboo-garden": { src: "tv", scale: 1.13, ox: 50, oy: 100 },
  // Turn bar top left, hand bar along the bottom, jar bottom right.
  "night-flight": { src: "tv", scale: 1.85, ox: 46, oy: 49 },
  "story-nook": { src: "tv", scale: 1.04, ox: 50, oy: 60 },
  hearthisle: { src: "tv", scale: 1.06, ox: 50, oy: 50 },
};

/** The capture to show for a game, zoomed so none of its HUD reaches the frame. */
export function frameFor(gameId: string): Frame | null {
  const g = gameById(gameId);
  const safe = SAFE[gameId] ?? { src: "tv", scale: 1, ox: 50, oy: 50 };
  const src = safe.src === "alt" ? (g.art.alt ?? g.art.tv) : g.art.tv;
  if (!src) return null;
  return { src, scale: safe.scale, ox: safe.ox, oy: safe.oy };
}
