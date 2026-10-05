/**
 * Onboarding's pages and how Next, Skip and Back move between them (acceptance
 * 2026-03-15-ogs-app-onboarding.feature). The notifications page is passed over, both ways, once
 * permission is granted.
 */
export const ONBOARDING_PAGES = ["welcome", "notifications", "profile", "done"] as const;

const NOTIFICATIONS = 1;
const PROFILE = 2;
const DONE = 3;

/** The page after `page`, or "finish" after the done page. */
export function nextFrom(page: number, notificationsGranted: boolean): number | "finish" {
  const next = page + 1;
  if (next === NOTIFICATIONS && notificationsGranted) return PROFILE;
  return next > DONE ? "finish" : next;
}

/** Skip skips the intro, never the profile: every device needs one. */
export function skipTo(): number {
  return PROFILE;
}

export function showsSkip(page: number): boolean {
  return page < PROFILE;
}

/** Back on every page after the welcome; not on the done page: the profile is made by then. */
export function showsBack(page: number): boolean {
  return page > 0 && page < DONE;
}

/** The page Back returns to (the page itself when there is none). */
export function backFrom(page: number, notificationsGranted: boolean): number {
  if (!showsBack(page)) return page;
  const back = page - 1;
  return back === NOTIFICATIONS && notificationsGranted ? 0 : back;
}

/**
 * Whether the pager slides from `from` to `to`: only to the page next door. A move that passes over
 * a page (the granted notifications page, on Make my profile, Skip and Back) jumps instead, so the
 * page it passes never shows.
 */
export function animatesMove(from: number, to: number): boolean {
  return Math.abs(to - from) === 1;
}
