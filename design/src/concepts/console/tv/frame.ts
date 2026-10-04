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

export interface Hero {
  src: string;
  /** Where the capture's top-left lands (px at 1920×1080) and its scale (< 1: denser, so sharper). */
  x: number;
  y: number;
  k: number;
}

/**
 * The console home's hero: the capture a little under native size (a soft capture reads sharper
 * smaller), hung from the top-right corner and slid right and up just far enough that the HUD the
 * safe crop hides leaves the frame. The edges it uncovers fade into the night under the home's scrims.
 */
export function heroFor(gameId: string, k = 0.78, w = 1920, h = 1080): Hero | null {
  const f = frameFor(gameId);
  if (!f) return null;
  const cut = (f.scale - 1) / f.scale;
  return { src: f.src, k, x: Math.round(w * (1 - k) + cut * (1 - f.ox / 100) * w * k), y: -Math.round(cut * (f.oy / 100) * h * k) };
}
