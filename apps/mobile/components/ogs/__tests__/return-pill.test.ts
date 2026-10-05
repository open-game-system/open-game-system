import { showsReturnPill } from "../return-pill";

// Owner, 2026-10-04: the Rejoin pill shows on TV, Friends and Profile only. Playing (its own
// pinned card) and Library (the game page's own Rejoin) already offer Rejoin, so no third copy.
describe("showsReturnPill", () => {
  it.each(["tv", "friends", "profile"])("shows on %s when there is a pill", (activeRoute) => {
    expect(showsReturnPill({ hasPill: true, activeRoute })).toBe(true);
  });

  it.each(["playing", "library"])("hides on %s even with a pill", (activeRoute) => {
    expect(showsReturnPill({ hasPill: true, activeRoute })).toBe(false);
  });

  it.each([
    "tv",
    "friends",
    "profile",
    "playing",
    "library",
  ])("hides on %s when there is nothing to rejoin", (activeRoute) => {
    expect(showsReturnPill({ hasPill: false, activeRoute })).toBe(false);
  });

  it("hides on a route that isn't a tab", () => {
    expect(showsReturnPill({ hasPill: true, activeRoute: "game" })).toBe(false);
    expect(showsReturnPill({ hasPill: true, activeRoute: undefined })).toBe(false);
  });
});
