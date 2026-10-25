/**
 * The starter game's rules, as pure functions (no clock, no I/O): the TV shows a sky of colored
 * kites for a few seconds, then every phone picks the color it thinks had the most. Replace this
 * file with your own game; the room machine only needs `makeRound`, `scorePick` and `winners`.
 */
export const COLORS = ["coral", "sky", "lime", "gold"] as const;
export type Color = (typeof COLORS)[number];

/** Rounds in one game. */
export const ROUNDS = 5;

/** How long each phase lasts (ms). The room keeps the deadline, so a restarted room carries on. */
export const TIMING = { showMs: 4500, answerMs: 9000, revealMs: 4500 } as const;

/** One kite: where it starts (0..1 of the TV), how fast it drifts, how big it is. */
export type Shape = { color: Color; x: number; y: number; drift: number; size: number };
export type Round = { shapes: Shape[]; answer: Color; counts: Record<Color, number> };

/** mulberry32: a small seeded generator, so a round is the same on every replay of a seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickInt = (next: () => number, lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));

/**
 * Round `index` of the game seeded `seed`. The answer color has the most kites, by exactly one or
 * more; later rounds have more kites and closer counts.
 */
export function makeRound(seed: number, index: number): Round {
  const next = rng(seed * 7919 + index * 104729 + 1);
  const answer = COLORS[pickInt(next, 0, COLORS.length - 1)] ?? "coral";
  const most = 3 + index;
  const closest = Math.max(1, most - 1 - Math.max(0, 2 - Math.floor(index / 2)));
  const counts: Record<Color, number> = { coral: 0, sky: 0, lime: 0, gold: 0 };
  for (const c of COLORS) counts[c] = c === answer ? most : pickInt(next, closest, most - 1);
  const shapes: Shape[] = [];
  for (const color of COLORS) {
    for (let i = 0; i < counts[color]; i++) {
      shapes.push({
        color,
        x: 0.06 + next() * 0.88,
        y: 0.12 + next() * 0.7,
        drift: 0.4 + next() * 0.8,
        size: 0.7 + next() * 0.5,
      });
    }
  }
  // Shuffle so colors don't arrive in clumps.
  for (let i = shapes.length - 1; i > 0; i--) {
    const j = pickInt(next, 0, i);
    const a = shapes[i];
    const b = shapes[j];
    if (a && b) {
      shapes[i] = b;
      shapes[j] = a;
    }
  }
  return { shapes, answer, counts };
}

export function scorePick(round: Round, pick: Color | null): number {
  return pick === round.answer ? 1 : 0;
}

/** The names on the top score (ties share the win). */
export function winners(players: { name: string; score: number }[]): string[] {
  if (players.length === 0) return [];
  const top = Math.max(...players.map((p) => p.score));
  return players.filter((p) => p.score === top).map((p) => p.name);
}
