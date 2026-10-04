import type { Scenario } from "../../harness/types";
import { mashing } from "./ipad/mash";
import { base, type S } from "./state";

const at = (patch: Partial<S>) => (): S => ({ ...base(), ...patch });
const ava: Partial<S> = { ipad: "ava" };
const cut = (phase: "saving" | "cutover" | "following", extra: Partial<S> = {}) =>
  at({ phone: "controller", switching: { from: "rocket-crew", to: "bake-shop", phase, undo: false }, ...extra });

/** Scenarios owned by the kid surfaces owner (ids must not collide with scenarios.ts). */
export const kidScenarios: Scenario<S>[] = [
  { id: "kid.01-ava-idle", label: "Ava's iPad: paired, nothing on TV for her, a toy", flow: "home", state: "default", devices: ["ipad"], build: at({ ...ava, onTv: null }) },
  { id: "kid.02-menu-paused", label: "Console menu open: TV paused, Juneau's dragon steps onto the path", flow: "swap", state: "partial", devices: ["ipad"], build: at({ phone: "controller", menu: true }) },
  { id: "kid.03-ava-menu-paused", label: "Console menu open on Ava's iPad", flow: "swap", state: "partial", devices: ["ipad"], build: at({ ...ava, phone: "controller", menu: true }) },
  { id: "kid.04-ava-saving", label: "Ava's iPad while Rocket Crew saves", flow: "swap", state: "loading", devices: ["ipad"], build: cut("saving", ava) },
  { id: "kid.05-ava-cutover", label: "Ava's dinosaur walking the path during the cut", flow: "swap", state: "loading", devices: ["ipad"], build: cut("cutover", ava) },
  { id: "kid.06-ava-rocket-helper", label: "Ava in Rocket Crew: two giant always-right buttons", flow: "swap", state: "default", devices: ["ipad"], build: at({ ...ava, phone: "controller" }) },
  { id: "kid.07-undo-follow", label: "Undo: Juneau's dragon walks back to Rocket Crew", flow: "swap", state: "undone", devices: ["ipad"], build: at({ phone: "controller", onTv: "bake-shop", switching: { from: "bake-shop", to: "rocket-crew", phase: "cutover", undo: true } }) },
  { id: "kid.08-ava-asleep-switching", label: "Ava's iPad asleep at 9% while everyone moves: she stays asleep, seat kept", flow: "swap", state: "interrupted", devices: ["ipad"], build: cut("following", { ...ava, asleep: ["dev-ava-ipad"] }) },
  { id: "kid.09-juneau-bake-switch-following", label: "Juneau's iPad: Bake Shop opens wide around the dragon", flow: "swap", state: "partial", devices: ["ipad"], build: cut("following") },
  { id: "kid.11-window-wish", label: "Window to the TV: Juneau pokes Peekaboo Garden on his iPad; his dragon lands on that tile on the TV too", flow: "home", state: "success", devices: ["ipad", "tv"], build: at({ onTv: null, tvFocus: "bake-shop", wish: { juneau: "peekaboo-garden" }, poke: { target: "peekaboo-garden", by: "juneau", n: 1 } }) },
  { id: "kid.12-ava-wish-paused", label: "Console menu open: Ava's dinosaur wishes for Bake Shop from the Up next shelf, the TV shows it", flow: "swap", state: "partial", devices: ["ipad", "tv"], build: at({ ...ava, phone: "controller", menu: true, wish: { ava: "bake-shop", juneau: "peekaboo-garden" }, poke: { target: "bake-shop", by: "ava", n: 1 } }) },
  { id: "kid.10-ava-mash-cutover", label: "Ava mashes her iPad during the cut: every tap sparkles, her dinosaur giggles, nothing changes", flow: "swap", state: "loading", devices: ["ipad"], build: () => { const s = cut("cutover", ava)(); mashing.add(s); return s; } },
];
