type Options = {
  /** Touches must start within this many points of the left edge. */
  edge: number;
  /** Drag distance that counts as "go back". */
  threshold: number;
  /** Screen width (where the view slides to when going back). */
  width: number;
  /** Move the view with the finger. */
  follow(dx: number): void;
  /** Animate the view to a resting offset, then call done. */
  settle(toValue: number, done?: () => void): void;
  onBack(): void;
};

/**
 * The game screen's edge swipe-back. Every way a drag can end — release, or another gesture
 * (iOS back-swipe, the WebView) taking over — settles the view, so it never stays shifted.
 */
export function swipeBackHandlers({ edge, threshold, width, follow, settle, onBack }: Options) {
  return {
    startsAt: (pageX: number) => pageX < edge,
    move(dx: number) {
      if (dx > 0) follow(dx);
    },
    release(dx: number) {
      if (dx > threshold) settle(width, onBack);
      else settle(0);
    },
    terminate() {
      settle(0);
    },
  };
}
