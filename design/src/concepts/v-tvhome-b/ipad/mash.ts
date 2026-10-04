// Mash-proofing for the littlest (Ava, almost 3). Every tap answers with a harmless sparkle; three
// or more taps inside a second make the character giggle (a wiggle-bounce). That is all a tap can
// do on a following iPad: nothing here reads or writes the session.
import { useCallback, useEffect, useRef, useState } from "react";

const WINDOW_MS = 1000;
const MASH_TAPS = 3;
const GIGGLE_MS = 900;

/** Scenario states that show a child mid-mash (keyed by the built state object, like dev/pages.ts). */
export const mashing = new WeakSet<object>();

export function useMash(demo: boolean) {
  const taps = useRef<number[]>([]);
  const [giggle, setGiggle] = useState(demo);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const tap = useCallback(() => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < WINDOW_MS), now];
    if (taps.current.length < MASH_TAPS) return;
    setGiggle(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setGiggle(demo), GIGGLE_MS);
  }, [demo]);
  return { giggle, tap };
}

/** Where a mashing toddler's fingers land in the demo (iPad points): mostly the bottom half. */
export const MASH_SPOTS = [
  { x: 210, y: 640, d: 0 },
  { x: 980, y: 600, d: 0.22 },
  { x: 560, y: 470, d: 0.41 },
  { x: 330, y: 470, d: 0.63 },
  { x: 840, y: 720, d: 0.12 },
  { x: 700, y: 560, d: 0.52 },
];
