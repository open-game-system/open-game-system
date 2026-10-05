import type { TabRoute } from "./tab-items";

/**
 * Owner, 2026-10-04: the Rejoin pill sits above the tabs on TV, Friends and Profile only. Playing
 * (its pinned card) and Library (the game page's own Rejoin) already offer Rejoin.
 */
const PILL_TABS: readonly TabRoute[] = ["tv", "friends", "profile"];

export function showsReturnPill(input: {
  hasPill: boolean;
  activeRoute: string | undefined;
}): boolean {
  return input.hasPill && PILL_TABS.some((route) => route === input.activeRoute);
}
