import { TAB_ITEMS, tabAccessibilityLabel, tabItem } from "../tab-items";

describe("tab items (owner decision: five tabs)", () => {
  it("lists Playing, TV, Library, Friends, Profile in that order", () => {
    expect(TAB_ITEMS.map((t) => t.route)).toEqual([
      "playing",
      "tv",
      "library",
      "friends",
      "profile",
    ]);
    expect(TAB_ITEMS.map((t) => t.label)).toEqual([
      "Playing",
      "TV",
      "Library",
      "Friends",
      "Profile",
    ]);
  });

  it("keeps the testIDs the e2e suites use", () => {
    expect(TAB_ITEMS.map((t) => t.testID)).toEqual([
      "tabPlaying",
      "tabTV",
      "tabLibrary",
      "tabFriends",
      "tabProfile",
    ]);
  });

  it("looks a tab up by route, and knows no other routes", () => {
    expect(tabItem("friends")?.testID).toBe("tabFriends");
    expect(tabItem("settings")).toBeUndefined();
  });

  it("says the Playing badge and the TV cast in the accessibility label", () => {
    const playing = tabItem("playing");
    const tv = tabItem("tv");
    const profile = tabItem("profile");
    if (!playing || !tv || !profile) throw new Error("missing tab");
    expect(tabAccessibilityLabel(playing, { badge: 2, cast: false })).toBe("Playing, 2 your turn");
    expect(tabAccessibilityLabel(playing, { badge: 0, cast: true })).toBe("Playing");
    expect(tabAccessibilityLabel(tv, { badge: 3, cast: true })).toBe("TV, cast");
    expect(tabAccessibilityLabel(tv, { badge: 0, cast: false })).toBe("TV");
    expect(tabAccessibilityLabel(profile, { badge: 1, cast: true })).toBe("Profile and settings");
  });
});
