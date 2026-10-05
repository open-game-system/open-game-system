import { sittingClock, sittingName, sittingStartedAt } from "@open-game-system/ogs-protocol";
import { playedAgo, type Sitting } from "../../../services/sittings";

/** When a sitting began (the shared rule in ogs-protocol: read back from an OGS sitting id). */
export const startedAt = (sitting: Sitting, appId: string, now: number): number =>
  sittingStartedAt({ ...sitting, appId }, now);

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
  return { headline: sittingName({ ...sitting, appId }, now), detail };
}

/**
 * Every card on a game's page, never two alike: when headlines collide (two sittings with no
 * resume point started the same minute), they become "Game 1", "Game 2" by start order and the
 * start time moves to the second line.
 */
export function sittingTitles(
  sittings: Sitting[],
  appId: string,
  now: number,
): { headline: string; detail: string }[] {
  const titles = sittings.map((s) => sittingTitle(s, appId, now));
  const counts = new Map<string, number>();
  for (const t of titles) counts.set(t.headline, (counts.get(t.headline) ?? 0) + 1);
  if (![...counts.values()].some((n) => n > 1)) return withStarts(titles, sittings, appId, now);
  const byStart = [...sittings].sort((a, b) => startedAt(a, appId, now) - startedAt(b, appId, now));
  return sittings.map((s, i) => {
    const t = titles[i];
    if ((counts.get(t.headline) ?? 0) < 2) return t;
    const when = s.live ? "on the TV now" : playedAgo(s.at, now).toLowerCase();
    return {
      headline: `Game ${byStart.indexOf(s) + 1}`,
      detail: `${sittingClock(startedAt(s, appId, now))} · ${when}`,
    };
  });
}

/**
 * Distinct headlines whose second lines collide ("Played just now" twice): a card named by its
 * resume point ("Day 3") says when it started instead ("Started 1:42 PM · just now"), short
 * enough for one line at 375 pt, so the two never read alike. A card already
 * named by its start ("Started 7:42 PM") keeps its line.
 */
function withStarts(
  titles: { headline: string; detail: string }[],
  sittings: Sitting[],
  appId: string,
  now: number,
): { headline: string; detail: string }[] {
  const counts = new Map<string, number>();
  for (const t of titles) counts.set(t.detail, (counts.get(t.detail) ?? 0) + 1);
  return titles.map((t, i) => {
    const s = sittings[i];
    if ((counts.get(t.detail) ?? 0) < 2 || !s.label) return t;
    const started = sittingName({ ...s, label: "", appId }, now);
    const when = s.live ? "on the TV now" : playedAgo(s.at, now).toLowerCase();
    return { ...t, detail: `${started} · ${when}` };
  });
}
