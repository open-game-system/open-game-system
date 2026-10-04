import { keyboardOverlap, revealOffset } from "../keyboard";

describe("keyboardOverlap (how much of a view the keyboard covers, in window points)", () => {
  it("is the part of the view below the keyboard's top", () => {
    // iPhone 17 Pro: a full-height view (874) and a 336-point keyboard (top at 538).
    expect(keyboardOverlap({ y: 0, height: 874 }, 538)).toBe(336);
  });

  it("counts where the view sits in the window, not just its height", () => {
    // The onboarding page starts 84 points down and ends 68 points above the bottom (the dots).
    expect(keyboardOverlap({ y: 84, height: 722 }, 538)).toBe(268);
  });

  it("in a modal sheet, counts the sheet's offset from the top of the display", () => {
    // A sheet 812 tall on an 874 display sits 62 points down; React Native lays its page out from
    // y 0 inside it. The whole page (y 0, height 812) is covered from 476 down: 336 points.
    expect(keyboardOverlap({ y: 0, height: 812 }, 538, { container: 812, window: 874 })).toBe(336);
    // A footer screen that fills the display (no sheet) is unchanged.
    expect(keyboardOverlap({ y: 0, height: 874 }, 538, { container: 874, window: 874 })).toBe(336);
  });

  it("is zero when the keyboard is down or below the view", () => {
    expect(keyboardOverlap({ y: 0, height: 874 }, 874)).toBe(0);
    expect(keyboardOverlap({ y: 0, height: 500 }, 538)).toBe(0);
  });
});

describe("revealOffset (scroll a focused field into the space above the keyboard)", () => {
  const viewport = { offset: 0, height: 240 };

  it("leaves the scroll alone while the field is in view", () => {
    expect(revealOffset({ top: 100, height: 48 }, viewport, 12)).toBeNull();
  });

  it("scrolls up just enough to show the field (with a margin) when it is below the view", () => {
    // Field bottom 348 + margin 12 must reach the viewport bottom (offset + 240).
    expect(revealOffset({ top: 300, height: 48 }, viewport, 12)).toBe(120);
  });

  it("scrolls down to the field when it is above the view", () => {
    expect(revealOffset({ top: 40, height: 48 }, { offset: 100, height: 240 }, 12)).toBe(28);
  });

  it("never scrolls past the top", () => {
    expect(revealOffset({ top: 4, height: 48 }, { offset: 100, height: 240 }, 12)).toBe(0);
  });

  it("a field taller than the view shows its top", () => {
    expect(revealOffset({ top: 300, height: 400 }, viewport, 12)).toBe(288);
  });
});
