import type { Scenario } from "../../harness/types";
import { base, playMove, type S, type SwitchStep } from "./state";

const RC = "rocket-crew";
const BS = "bake-shop";
const swapAt = (step: SwitchStep, over: Partial<S> = {}): S =>
  base({ phone: "game", tonight: { kind: "switching", from: RC, to: BS, step, undo: false }, ...over });
const bakeShop = (over: Partial<S> = {}): S =>
  base({ phone: "game", tonight: { kind: "playing", gameId: BS, after: { from: RC, undone: false } }, ...over });

export const scenarios: Scenario<S>[] = [
  // Home: the household first.
  { id: "home.01-tonight", label: "Friday 7:10 · Rocket Crew on the TV, noticeboard below", flow: "home", state: "default", devices: ["phone", "tv", "ipad"], build: () => base() },
  { id: "home.02-before-the-game", label: "7:00 · TV cast and idle: the family's screen; Juneau's iPad paired and waiting", flow: "home", state: "default", devices: ["phone", "tv", "ipad"], build: () => base({ clock: "7:00", tonight: { kind: "idle" } }) },
  { id: "home.03-switch-sheet", label: "Switch the TV to… (from home)", flow: "home", state: "default", devices: ["phone"], build: () => base({ sheet: "switcher" }) },
  { id: "home.04-family", label: "The household: people, paired devices, what other homes see", flow: "home", state: "default", devices: ["phone"], build: () => base({ phone: "family" }) },
  { id: "home.05-first-run", label: "First evening: set the table", flow: "home", state: "empty", devices: ["phone"], build: () => base({ phone: "first-run", tonight: { kind: "idle" } }) },

  // Swap Rocket Crew → Bake Shop, every device.
  { id: "swap.01-mid-game", label: "Mission 6: Dad captains on the phone, Juneau fixes on his iPad", flow: "swap", state: "default", devices: ["phone", "tv", "ipad"], build: () => base({ phone: "game" }) },
  { id: "swap.02-choose-next", label: "Switch the TV to…: Bake Shop day 4 on top, seats already filled", flow: "swap", state: "default", devices: ["phone", "tv", "ipad"], build: () => base({ phone: "game", sheet: "switcher" }) },
  { id: "swap.03-saving", label: "Saving mission 6: the game folds into a picture", flow: "swap", state: "loading", devices: ["phone", "tv", "ipad"], build: () => swapAt("saving") },
  { id: "swap.04-tv-cutover", label: "TV cut-over in the same cast: mission 6 hung on the wall, Bake Shop opens", flow: "swap", state: "loading", devices: ["phone", "tv", "ipad"], build: () => swapAt("cutover") },
  { id: "swap.05-kids-following", label: "Kids' iPads follow: Ember hops to Bake Shop; place cards sit down on the TV", flow: "swap", state: "loading", devices: ["phone", "tv", "ipad"], build: () => swapAt("following") },
  { id: "swap.06-bake-shop", label: "Bake Shop day 4, everyone in their seat; undo offered", flow: "swap", state: "success", devices: ["phone", "tv", "ipad"], build: () => bakeShop() },
  { id: "swap.07-ava-following", label: "Ava's iPad (with Ava's view) mid-follow", flow: "swap", state: "loading", devices: ["ipad"], build: () => swapAt("following", { ipadOf: "ava" }) },
  { id: "swap.08-ava-asleep", label: "Ava's iPad slept at 9% and missed it: calm note, her seat waits", flow: "swap", state: "interrupted", devices: ["phone", "ipad"], build: () => bakeShop({ ipadOf: "ava", avaAsleep: true }) },
  { id: "swap.09-ava-asleep-progress", label: "The checklist shows Ava's iPad asleep while the others follow", flow: "swap", state: "interrupted", devices: ["phone", "tv"], build: () => swapAt("following", { avaAsleep: true }) },
  { id: "swap.10-ava-caught-up", label: "Ava's iPad woke on the charger and went straight to her bell", flow: "swap", state: "success", devices: ["phone", "ipad"], build: () => bakeShop({ ipadOf: "ava", avaAsleep: true, avaCaughtUp: true }) },
  { id: "swap.11-undo-resuming", label: "Back to Rocket Crew: Bake Shop saves at day 4", flow: "swap", state: "undone", devices: ["phone", "tv", "ipad"], build: () => base({ phone: "game", tonight: { kind: "switching", from: BS, to: RC, step: "cutover", undo: true } }) },
  { id: "swap.12-undone", label: "Mission 6 resumed exactly where it was", flow: "swap", state: "undone", devices: ["phone", "tv", "ipad"], build: () => base({ phone: "game", tonight: { kind: "playing", gameId: RC, after: { from: BS, undone: true } } }) },

  // Word Duel.
  { id: "word-duel.00-push", label: "Nana's move arrives: one push, grown-up phone only", flow: "word-duel", state: "default", devices: ["phone"], build: () => base({ phone: "lock", clock: "6:47" }) },
  { id: "word-duel.01-list", label: "Word Duel: your move ×2, their move ×3, finished and closed", flow: "word-duel", state: "default", devices: ["phone"], build: () => base({ phone: "duels" }) },
  { id: "word-duel.02-nana", label: "Nana's game: she played QUILT", flow: "word-duel", state: "default", devices: ["phone"], build: () => base({ phone: "duel", openDuel: "wd-1" }) },
  { id: "word-duel.03-placing", label: "Placing LOFT down from the L", flow: "word-duel", state: "partial", devices: ["phone"], build: () => base({ phone: "duel", openDuel: "wd-1", placed: ["O", "F", "T"] }) },
  { id: "word-duel.04-sent", label: "Sent to Nana; next: Mom's game", flow: "word-duel", state: "success", devices: ["phone"], build: () => playMoveScenario() },
  { id: "word-duel.05-list-after", label: "Back to the list: Nana's game moved to their move", flow: "word-duel", state: "success", devices: ["phone"], build: () => ({ ...playMoveScenario(), phone: "duels", openDuel: null, placed: [], sent: false }) },
  { id: "word-duel.06-new-game", label: "New game: one per opponent", flow: "word-duel", state: "default", devices: ["phone"], build: () => base({ phone: "duels", sheet: "new-duel" }) },
  { id: "word-duel.07-empty", label: "No word games yet", flow: "word-duel", state: "empty", devices: ["phone"], build: () => base({ phone: "duels", duels: [] }) },
];

function playMoveScenario(): S {
  return playMove(base({ phone: "duel", openDuel: "wd-1", placed: ["O", "F", "T"] }));
}
