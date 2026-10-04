/**
 * Each fact once per screen (owner, 2026-10-04): the focused game's status and tagline live in the
 * spotlight only; cards carry what tells sittings apart (their resume point) and a short "when"
 * only for games the spotlight isn't showing.
 */

/** The longest tagline that sits on one line beside the logo (760 px at 28 px) without crowding. */
export const SPOT_TAGLINE_FITS = 44;

export interface SpotLine {
  /** The status chip ("Paused just now"), or "" for a game not started. */
  tag: string;
  /** The resume point ("Day 4"), or "" when it would repeat the status. */
  resume: string;
  /** The game's tagline, or "" when it doesn't fit or would repeat a word. */
  tagline: string;
}

/** Words that carry meaning (4+ letters), lower-cased: "the", "at", "of" don't count as repeats. */
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9']{4,}/g) ?? []);
const repeats = (said: string, next: string) =>
  said.toLowerCase().includes(next.toLowerCase()) ||
  [...words(next)].some((w) => words(said).has(w));

/** The spotlight's line under the logo: status chip and resume point, then the tagline if it fits. */
export function spotLine(
  icon: { tag: string; resume: string; tagline: string },
  zone: "icons" | "cards",
): SpotLine {
  if (!icon.tag) return { tag: "", resume: "", tagline: icon.tagline };
  const resume = repeats(icon.tag, icon.resume) ? "" : icon.resume;
  const said = `${icon.tag} ${resume}`;
  const fits = zone === "icons" && icon.tagline.length <= SPOT_TAGLINE_FITS;
  const tagline = fits && !repeats(said, icon.tagline) ? icon.tagline : "";
  return { tag: icon.tag, resume, tagline };
}

/** A sitting card's chip: "" for the spotlit game (the spotlight says it), else its short when. */
export const cardChip = (card: { appId: string; chip: string }, spotApp: string | null): string =>
  card.appId === spotApp ? "" : card.chip;
