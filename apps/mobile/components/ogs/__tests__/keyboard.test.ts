import { contentTop, keyboardOverlap, revealOffset, revealSpan, settleDelay } from "../keyboard";

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

describe("revealSpan (a focused field and the field under it, shown together)", () => {
  it("is just the field when nothing comes with it", () => {
    expect(revealSpan({ top: 300, height: 48 }, null)).toEqual({ top: 300, height: 48 });
  });

  it("runs from the field's top to the bottom of the one below it", () => {
    // The name (top 300) and, 30 points under it, the @id row with its check (48 tall).
    expect(revealSpan({ top: 300, height: 48 }, { top: 378, height: 48 })).toEqual({
      top: 300,
      height: 126,
    });
  });

  it("covers both whichever comes first", () => {
    expect(revealSpan({ top: 378, height: 48 }, { top: 300, height: 48 })).toEqual({
      top: 300,
      height: 126,
    });
  });

  it("the name in view with its @id under the footer scrolls until the @id shows too", () => {
    // phone-02: viewport 440 tall, the name fits but the @id row ends at 470 (under the footer).
    const viewport = { offset: 0, height: 440 };
    expect(revealOffset({ top: 340, height: 52 }, viewport, 16)).toBeNull();
    const span = revealSpan({ top: 340, height: 52 }, { top: 422, height: 52 });
    expect(revealOffset(span, viewport, 16)).toBe(50);
  });
});

describe("settleDelay (wait for the page to finish shrinking before scrolling)", () => {
  it("waits out the rest of the page's resize animation, plus a frame", () => {
    // The resize ends at 1250; at 1000 a scroll would be clamped to the taller, older page.
    expect(settleDelay(1250, 1000)).toBe(266);
  });

  it("is zero once the page has settled", () => {
    expect(settleDelay(1250, 1250)).toBe(0);
    expect(settleDelay(1000, 1250)).toBe(0);
  });
});

describe("contentTop (a view's place in the scroll content, from the window)", () => {
  it("is its window y below the page's top", () => {
    // The page starts 84 down; the name field is at 497 in the window: 413 into the content.
    expect(contentTop(497, 84, 0)).toBe(413);
  });

  it("adds how far the page has scrolled", () => {
    expect(contentTop(447, 84, 50)).toBe(413);
  });
});
