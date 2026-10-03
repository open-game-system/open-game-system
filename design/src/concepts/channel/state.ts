// Session state for "Game Night Channel": tonight is a programme on the family's channel.
// One store, shared by every device: the phone directs, the TV broadcasts, kid iPads follow.
import { DUELS, type DuelGame } from "../../world";
import type { Store } from "../../harness/store";

export type PhoneScreen = "home" | "schedule" | "controller" | "director" | "duel-list" | "duel-board" | "duel-new" | "first-run";
/** A cut between segments, step by step. null = nothing in flight. */
export type CutStep = "saving" | "ident" | "following";
export type Kid = "juneau" | "ava";

export interface S {
  phone: PhoneScreen;
  /** off = not cast; continuity = channel on air, no segment playing; segment = a game owns the TV. */
  tv: "off" | "continuity" | "segment";
  /** The game on air (or coming up, in continuity). */
  onAir: string;
  /** The segment we cut away from (its resume point is saved), for "back to …". */
  prev: string | null;
  cut: CutStep | null;
  /** The segment the director has lined up next in the running order. */
  next: string;
  /** A lower third the channel shows for a few seconds after a cut. */
  lowerThird: "intro" | "back" | null;
  /** Which kid's iPad the ipad surface is. */
  ipad: Kid;
  avaAsleep: boolean;
  avaNotice: boolean;
  undoOpen: boolean;
  duels: DuelGame[];
  duelOpen: string | null;
  placed: string[];
  sent: boolean;
  /** Kid juice counters (taps do something visible, never navigate). */
  juice: number;
}

export const base = (over: Partial<S> = {}): S => ({
  phone: "home",
  tv: "segment",
  onAir: "rocket-crew",
  prev: null,
  cut: null,
  next: "bake-shop",
  lowerThird: null,
  ipad: "juneau",
  avaAsleep: false,
  avaNotice: false,
  undoOpen: false,
  duels: DUELS,
  duelOpen: null,
  placed: [],
  sent: false,
  juice: 0,
  ...over,
});

const timers = new Set<ReturnType<typeof setTimeout>>();
const later = (ms: number, fn: () => void) => {
  const t = setTimeout(() => {
    timers.delete(t);
    fn();
  }, ms);
  timers.add(t);
};

/** Cut to the next segment: save the old one, ident on the TV, kid iPads follow, new game on air. */
export function cutTo(store: Store<S>, to: string, lowerThird: "intro" | "back" = "intro") {
  timers.forEach(clearTimeout);
  timers.clear();
  store.update((s) => ({ ...s, phone: "controller", prev: s.onAir, next: to, cut: "saving", lowerThird: null, undoOpen: false }));
  later(1700, () => store.update((s) => ({ ...s, cut: "ident" })));
  later(3500, () => store.update((s) => ({ ...s, cut: "following", onAir: to })));
  later(5400, () =>
    store.update((s) => ({ ...s, cut: null, lowerThird, undoOpen: lowerThird === "intro", avaNotice: s.avaAsleep })),
  );
  later(14000, () => store.update((s) => ({ ...s, lowerThird: null })));
}

export function goBack(store: Store<S>) {
  const prev = store.get().prev;
  if (prev) cutTo(store, prev, "back");
}

export const go = (store: Store<S>, phone: PhoneScreen) => store.update((s) => ({ ...s, phone }));
