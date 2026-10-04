import type { Scenario } from "../../harness/types";
import { base, type S } from "./state";

const at = (patch: Partial<S>) => (): S => ({ ...base(), ...patch });
const bakeLive: Partial<S> = { phone: "controller", onTv: "bake-shop", tvFocus: "bake-shop", left: { gameId: "rocket-crew", undone: false }, savedTonight: { "rocket-crew": "7:14 pm" } };

/** Scenarios owned by the TV surfaces owner (ids must not collide with scenarios.ts). */
export const tvScenarios: Scenario<S>[] = [
  // The "just cut" frame is swap.05 (the band over the new game, every seat lit); these are the
  // frames ~4 s later, when the band has settled into the corner chip and the game owns the TV.
  { id: "swap.06b-tv-settled", label: "TV 4 s after the cut: the game owns the screen, a corner chip remains", flow: "swap", state: "success", devices: ["tv"], build: at(bakeLive) },
  { id: "swap.09b-tv-asleep-settled", label: "TV after the cut with Ava's iPad asleep: her seat waits, dimmed in the chip", flow: "swap", state: "interrupted", devices: ["tv"], build: at({ ...bakeLive, asleep: ["dev-ava-ipad"] }) },
  // Hearthisle game night as the Mumms' TV shows it: the shared board, full-bleed; our seat and whose turn in the corner.
  { id: "game-night.40-tv-our-board", label: "Game night on the living room TV: the shared board, our seat and whose turn", flow: "game-night", state: "default", devices: ["tv"], build: at({ phone: "controller", onTv: "hearthisle", tvFocus: "hearthisle" }) },
];
