/**
 * How a sitting (one paused or in-progress play of a game) is named, the same on the phone and the
 * TV: the game's resume point ("Mission 6", "Day 4", "Room PQWS"), else when it started.
 */
export interface SittingStamp {
  appId: string;
  instanceId: string;
  /** The game's resume point or title; empty when it never said. */
  label: string;
  /** When it was last played, ms since epoch. */
  at: number;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * When a sitting began: OGS mints sitting ids as `<appId>-<start time base 36>`, so that time is
 * read back; any other id (a game's own room code) falls back to when it was last played.
 */
export function sittingStartedAt(s: SittingStamp, now: number): number {
  const prefix = `${s.appId}-`;
  const rest = s.instanceId.startsWith(prefix) ? s.instanceId.slice(prefix.length) : "";
  const t = /^[0-9a-z]+$/.test(rest) ? Number.parseInt(rest, 36) : Number.NaN;
  return Number.isFinite(t) && t <= s.at && t <= now ? t : s.at;
}

/** "7:42 PM". */
export function sittingClock(t: number): string {
  const d = new Date(t);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const dayStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** The resume point, else "Started 7:42 PM", "Started yesterday", "Started 3 days ago". */
export function sittingName(s: SittingStamp, now: number): string {
  if (s.label) return s.label;
  const start = sittingStartedAt(s, now);
  const days = Math.round((dayStart(now) - dayStart(start)) / DAY);
  const when = days <= 0 ? sittingClock(start) : days === 1 ? "yesterday" : `${days} days ago`;
  return `Started ${when}`;
}
