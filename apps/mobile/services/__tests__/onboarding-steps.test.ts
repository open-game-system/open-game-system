import {
  backFrom,
  nextFrom,
  ONBOARDING_PAGES,
  showsBack,
  showsSkip,
  skipTo,
} from "../onboarding-steps";

/** Acceptance 2026-03-15-ogs-app-onboarding.feature: welcome, notifications, profile, done. */
describe("onboarding steps", () => {
  it("has four pages in order", () => {
    expect(ONBOARDING_PAGES).toEqual(["welcome", "notifications", "profile", "done"]);
  });

  describe("Make my profile / Next", () => {
    it("goes from the welcome to the notifications page while permission is not asked", () => {
      expect(nextFrom(0, false)).toBe(1);
    });
    it("goes straight to the profile step when notifications are already granted", () => {
      expect(nextFrom(0, true)).toBe(2);
    });
    it("goes from the notifications page to the profile step", () => {
      expect(nextFrom(1, false)).toBe(2);
    });
    it("goes from the profile step to the done page", () => {
      expect(nextFrom(2, true)).toBe(3);
    });
    it("finishes after the done page", () => {
      expect(nextFrom(3, false)).toBe("finish");
    });
  });

  describe("Skip", () => {
    it("lands on the profile step, never past it", () => {
      expect(skipTo()).toBe(2);
    });
    it("shows on the welcome and notifications pages only", () => {
      expect([0, 1, 2, 3].map(showsSkip)).toEqual([true, true, false, false]);
    });
  });

  describe("Back", () => {
    it("is on every page after the welcome, except the done page (the profile is made by then)", () => {
      expect([0, 1, 2, 3].map(showsBack)).toEqual([false, true, true, false]);
    });
    it("goes from the notifications page to the welcome", () => {
      expect(backFrom(1, false)).toBe(0);
    });
    it("goes from the profile step to the notifications page while permission is not asked", () => {
      expect(backFrom(2, false)).toBe(1);
    });
    it("goes from the profile step to the welcome when notifications are already granted", () => {
      expect(backFrom(2, true)).toBe(0);
    });
    it("stays on the welcome (nothing before it)", () => {
      expect(backFrom(0, false)).toBe(0);
    });
    it("never leaves the done page (one profile per device)", () => {
      expect(backFrom(3, false)).toBe(3);
    });
  });
});
