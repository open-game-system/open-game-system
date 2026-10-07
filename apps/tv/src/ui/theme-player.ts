/** The part of an HTMLAudioElement the theme player uses. */
export interface ThemeTrack {
  loop: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
}

export interface ThemePlayer {
  /** The theme that should be playing now (null: silence). Crossfades from whatever was. */
  set(src: string | null): void;
  /** A user input: start a theme the browser refused to autoplay. */
  retry(): void;
  dispose(): void;
}

interface Voice {
  /** As asked for: an element's own `src` reads back absolute. */
  src: string;
  track: ThemeTrack;
  from: number;
  to: number;
  at: number;
  blocked: boolean;
}

const TICK_MS = 30;

/**
 * Plays one theme at a time, quietly and looped, crossfading by volume ramps. A theme the browser
 * won't autoplay waits silently for `retry` (the next key press); nothing throws.
 */
export function createThemePlayer(opts: {
  create: (src: string) => ThemeTrack;
  release?: (track: ThemeTrack) => void;
  volume?: number;
  rampMs?: number;
}): ThemePlayer {
  const volume = opts.volume ?? 0.5;
  const rampMs = opts.rampMs ?? 600;
  const voices: Voice[] = [];
  let current: Voice | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const level = (v: Voice, now: number) => {
    const k = Math.min(1, (now - v.at) / rampMs);
    return k >= 1 ? v.to : v.from + (v.to - v.from) * k;
  };

  const ramp = (v: Voice, to: number) => {
    const now = Date.now();
    v.from = level(v, now);
    v.to = to;
    v.at = now;
    v.track.volume = v.from;
  };

  const start = (v: Voice) => {
    v.blocked = false;
    v.track.play().catch(() => {
      // Autoplay refused (a plain browser before any input): stay silent, retry on the next key.
      v.blocked = true;
    });
  };

  const drop = (v: Voice) => {
    v.track.pause();
    voices.splice(voices.indexOf(v), 1);
    opts.release?.(v.track);
  };

  const tick = () => {
    const now = Date.now();
    for (const v of [...voices]) {
      v.track.volume = level(v, now);
      if (v.to === 0 && v !== current && now - v.at >= rampMs) drop(v);
    }
    if (voices.every((v) => now - v.at >= rampMs)) stop();
  };

  const run = () => {
    timer ??= setInterval(tick, TICK_MS);
  };
  const stop = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };

  return {
    set(src) {
      if ((current?.src ?? null) === src) return;
      if (current) ramp(current, 0);
      const back = src ? voices.find((v) => v.src === src) : undefined;
      if (back) {
        current = back;
        ramp(back, volume);
      } else if (src) {
        const track = opts.create(src);
        track.loop = true;
        track.volume = 0;
        current = { src, track, from: 0, to: volume, at: Date.now(), blocked: false };
        voices.push(current);
        start(current);
      } else current = null;
      run();
    },
    retry() {
      if (!current?.blocked) return;
      current.from = 0;
      current.at = Date.now();
      current.track.volume = 0;
      start(current);
      run();
    },
    dispose() {
      stop();
      for (const v of [...voices]) drop(v);
      current = null;
    },
  };
}
