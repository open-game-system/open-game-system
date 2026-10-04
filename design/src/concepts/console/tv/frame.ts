// HUD-safe framing for game captures shown inside OGS chrome (home backdrop, shelf, cut-over,
// paused card). Captures carry each game's own HUD (Rocket Crew's top row and its faced planet,
// Bake Shop's corner sign, Night Flight's turn bar); OGS chrome must never collide with it. Each
// manifest declares its HUD-free crop (`art.safe`), so the TV code stays game-agnostic.
import { gameById } from "../../../world";

export interface Frame {
  src: string;
  /** Zoom applied to the capture (1 = untouched). */
  scale: number;
  /** transform-origin, in % of the capture: where the zoom anchors. */
  ox: number;
  oy: number;
}

/** The capture to show for a game, zoomed so none of its HUD reaches the frame. */
export function frameFor(gameId: string): Frame | null {
  const g = gameById(gameId);
  if (!g.art.tv) return null;
  const safe = g.art.safe ?? { scale: 1, ox: 50, oy: 50 };
  return { src: g.art.tv, ...safe };
}
