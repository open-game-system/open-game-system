import { playedAgo, type Sitting } from "../../../services/sittings";

/**
 * When a sitting began: OGS mints sitting ids as `<appId>-<start time base 36>`, so that time is
 * read back; any other id (a game's own room code) falls back to when it was last played.
 */
export function startedAt(sitting: Sitting, appId: string, now: number): number {
  const prefix = `${appId}-`;
  const rest = sitting.instanceId.startsWith(prefix) ? sitting.instanceId.slice(prefix.length) : "";
  const t = /^[0-9a-z]+$/.test(rest) ? Number.parseInt(rest, 36) : Number.NaN;
  return Number.isFinite(t) && t <= sitting.at && t <= now ? t : sitting.at;
}

const clock = (t: number) => {
  const d = new Date(t);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

const dayStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * A sitting row on a game's page: the headline is the game's resume point ("Mission 6"), else
 * when it started ("Started 7:42 PM", "Started yesterday"); the second line is when it was last
 * played, or "On the TV now". Never the section heading ("In progress") again.
 */
export function sittingTitle(
  sitting: Sitting,
  appId: string,
  now: number,
): { headline: string; detail: string } {
  const detail = sitting.live
    ? "On the TV now"
    : `Played ${playedAgo(sitting.at, now).toLowerCase()}`;
  if (sitting.label) return { headline: sitting.label, detail };
  const start = startedAt(sitting, appId, now);
  const days = Math.round((dayStart(now) - dayStart(start)) / (24 * 60 * 60 * 1000));
  const when = days <= 0 ? clock(start) : days === 1 ? "yesterday" : `${days} days ago`;
  return { headline: `Started ${when}`, detail };
}
