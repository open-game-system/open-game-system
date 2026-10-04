import type { SFSymbol } from "expo-symbols";

export type TabRoute = "playing" | "tv" | "library" | "friends" | "profile";

export interface TabItem {
  route: TabRoute;
  label: string;
  testID: string;
  /** SF Symbols above the label: outline when idle, filled when the tab is on. Profile shows your sticker. */
  symbol: { idle: SFSymbol; on: SFSymbol } | null;
}

/** Owner decision (Oct 2026): five tabs, always all five, in this order. */
export const TAB_ITEMS: readonly TabItem[] = [
  {
    route: "playing",
    label: "Playing",
    testID: "tabPlaying",
    symbol: { idle: "gamecontroller", on: "gamecontroller.fill" },
  },
  { route: "tv", label: "TV", testID: "tabTV", symbol: { idle: "tv", on: "tv.fill" } },
  {
    route: "library",
    label: "Library",
    testID: "tabLibrary",
    symbol: { idle: "square.grid.2x2", on: "square.grid.2x2.fill" },
  },
  {
    route: "friends",
    label: "Friends",
    testID: "tabFriends",
    symbol: { idle: "person.2", on: "person.2.fill" },
  },
  { route: "profile", label: "Profile", testID: "tabProfile", symbol: null },
];

export function tabItem(route: string): TabItem | undefined {
  return TAB_ITEMS.find((t) => t.route === route);
}

export function tabAccessibilityLabel(
  tab: TabItem,
  { badge, cast }: { badge: number; cast: boolean },
): string {
  if (tab.route === "playing" && badge > 0) return `Playing, ${badge} your turn`;
  if (tab.route === "tv" && cast) return "TV, cast";
  if (tab.route === "profile") return "Profile and settings";
  return tab.label;
}
