/** A frame over this long is a visible hitch. */
const LONG_FRAME_MS = 50;
/** Two minutes of intervals at 60 fps: the summary covers at most that much. */
const MAX_INTERVALS = 7200;

export interface FrameStats {
  frames: number;
  /** Frames over the time they took. */
  fps: number;
  p50Ms: number;
  p90Ms: number;
  worstMs: number;
  /** Intervals over 50 ms. */
  longFrames: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Nearest-rank percentile of sorted values. */
const pct = (sorted: number[], p: number) =>
  sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? 0;

/** Summary of requestAnimationFrame intervals (ms). */
export function frameStats(intervals: number[]): FrameStats {
  if (intervals.length === 0)
    return { frames: 0, fps: 0, p50Ms: 0, p90Ms: 0, worstMs: 0, longFrames: 0 };
  const sorted = [...intervals].sort((a, b) => a - b);
  const total = intervals.reduce((a, b) => a + b, 0);
  return {
    frames: intervals.length,
    fps: round1((intervals.length * 1000) / total),
    p50Ms: round1(pct(sorted, 0.5)),
    p90Ms: round1(pct(sorted, 0.9)),
    worstMs: round1(sorted[sorted.length - 1] ?? 0),
    longFrames: intervals.filter((ms) => ms > LONG_FRAME_MS).length,
  };
}

/**
 * Collects rAF timestamps into intervals; `drain` summarises and starts over. `pause` (the page was
 * hidden: rAF stops) drops the next interval so the hidden spell doesn't count as one long frame.
 */
export function createFrameMeter() {
  let last: number | null = null;
  let intervals: number[] = [];
  return {
    tick(now: number) {
      if (last !== null) {
        intervals.push(now - last);
        if (intervals.length > MAX_INTERVALS) intervals = intervals.slice(-MAX_INTERVALS);
      }
      last = now;
    },
    pause() {
      last = null;
    },
    drain(): FrameStats {
      const s = frameStats(intervals);
      intervals = [];
      return s;
    },
  };
}
