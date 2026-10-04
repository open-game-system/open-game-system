// "Doorway": the geometry of a switch, shared by the TV and the phone's map of it (which is the
// TV's doorway in miniature). Pure: where the arch is and where each person stands, per phase.
// The old game's world fills the screen; an arch opens in it onto the next game's world; the
// family walks through in order (phones first: they're in the moment the phone says so; then each
// iPad as it follows); then the arch widens until the next world is the whole screen.
import type { SwitchPhase } from "../state";
import type { SeatView } from "./Roster";

/** TV pixels (1920×1080). `b` = the arch's bottom edge, from the bottom of the screen. */
export interface Arch {
  w: number;
  h: number;
  b: number;
}

export const ARCH: Record<SwitchPhase, Arch> = {
  saving: { w: 300, h: 430, b: 96 },
  cutover: { w: 600, h: 800, b: 96 },
  following: { w: 2760, h: 2500, b: -40 },
};

export type WalkerState = "here" | "through" | "asleep";

export interface Walker {
  seat: SeatView;
  state: WalkerState;
  /** Centre x, bottom y (TV px), scale, opacity, and when it moves (ms after the phase starts). */
  x: number;
  y: number;
  k: number;
  o: number;
  delay: number;
  /** Walking this phase (a step bob plays while it moves). */
  moving: boolean;
}

const THRESHOLD = { x: 960, y: 110, k: 0.42, o: 0 };

/** Who is through the arch at this phase: phones from the cut-over, awake iPads when they follow. */
export function isThrough(x: SeatView, phase: SwitchPhase): boolean {
  if (x.state === "asleep") return false;
  return phase === "following" || (phase === "cutover" && x.device?.kind === "phone");
}

export function walkers(seats: SeatView[], phase: SwitchPhase): Walker[] {
  let queue = 0;
  let going = 0;
  return seats.map((seat) => {
    const through = isThrough(seat, phase);
    const throughBefore = phase === "following" && seat.device?.kind === "phone" && seat.state !== "asleep";
    if (seat.state === "asleep") {
      // Napping by the door; once the new world has the screen her seat shows in the corner row.
      return { seat, state: "asleep", x: 260, y: 44, k: 0.9, o: phase === "following" ? 0 : 1, delay: 0, moving: false };
    }
    if (through) {
      const delay = throughBefore ? 0 : going++ * 300;
      return { seat, state: "through", ...THRESHOLD, delay, moving: !throughBefore };
    }
    // Waiting their turn: a line along the floor, front of the line nearest the arch.
    const front = phase === "saving" ? 640 : 720;
    const x = front - queue * 225;
    queue += 1;
    return { seat, state: "here", x, y: 54, k: 1, o: 1, delay: queue * 90, moving: phase === "cutover" };
  });
}
