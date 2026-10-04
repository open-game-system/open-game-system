// The follow path every kid iPad draws between the game being left and the next one, and the
// arithmetic to place things along it by distance (CSS offset-distance is by arc length, so the
// footsteps that light behind the walking character are placed by arc length too).

/** One cubic, top-left card → swoop through the bottom (between the thumbs) → top-right card. */
export const TRAVEL = { x0: 240, y0: 280, x1: 300, y1: 760, x2: 880, y2: 760, x3: 940, y3: 280 };
export const TRAVEL_PATH = `M${TRAVEL.x0} ${TRAVEL.y0} C ${TRAVEL.x1} ${TRAVEL.y1}, ${TRAVEL.x2} ${TRAVEL.y2}, ${TRAVEL.x3} ${TRAVEL.y3}`;

interface Pt {
  x: number;
  y: number;
}

function at(t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  const p = TRAVEL;
  return { x: a * p.x0 + b * p.x1 + c * p.x2 + d * p.x3, y: a * p.y0 + b * p.y1 + c * p.y2 + d * p.y3 };
}

const SAMPLES = 600;
const table: { t: number; len: number; pt: Pt }[] = (() => {
  const out = [{ t: 0, len: 0, pt: at(0) }];
  let len = 0;
  let prev = at(0);
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const pt = at(t);
    len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    out.push({ t, len, pt });
    prev = pt;
  }
  return out;
})();
const TOTAL = table[table.length - 1]?.len ?? 1;

/** Point and unit normal at `pct` percent of the path's length (0–100). */
export function along(pct: number): { x: number; y: number; nx: number; ny: number } {
  const want = (Math.min(100, Math.max(0, pct)) / 100) * TOTAL;
  let i = table.findIndex((r) => r.len >= want);
  if (i < 1) i = 1;
  const a = table[i - 1];
  const b = table[i];
  if (!a || !b) return { x: TRAVEL.x0, y: TRAVEL.y0, nx: 0, ny: -1 };
  const k = b.len === a.len ? 0 : (want - a.len) / (b.len - a.len);
  const dx = b.pt.x - a.pt.x;
  const dy = b.pt.y - a.pt.y;
  const m = Math.hypot(dx, dy) || 1;
  return { x: a.pt.x + dx * k, y: a.pt.y + dy * k, nx: -dy / m, ny: dx / m };
}

/**
 * Where the walking character is in each phase (percent of the path), and how long the phase
 * lasts on the session clock (sim.ts: saving 1.3 s, cutover 1.5 s, following until the game opens).
 * The character never stops between phases: each phase starts where the previous one ended.
 */
export type Leg = { from: number; to: number; ms: number };
export type LegPhase = "paused" | "saving" | "cutover" | "following";
export const LEG: Record<LegPhase, Leg> = {
  paused: { from: 16, to: 16, ms: 0 },
  saving: { from: 16, to: 36, ms: 1300 },
  cutover: { from: 36, to: 80, ms: 1500 },
  following: { from: 80, to: 100, ms: 900 },
};
