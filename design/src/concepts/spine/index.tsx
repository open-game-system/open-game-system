// Concept D, "Shells on a Spine": every game feels like its own app; OGS is the thin spine that
// never changes (household, the cast, a turn inbox across games, the deck tab that swaps games).
import { defineConcept, type Scenario, type SurfaceProps } from "../../harness/types";
import { useStore } from "../../harness/store";
import css from "./concept.css?raw";
import { Ipad } from "./ipad/Ipad";
import { Phone } from "./phone/Phone";
import { afterMove, with_, type S } from "./state";
import { Tv } from "./tv/Tv";
import { DUELS } from "../../world";

function Surface({ device, store, shot }: SurfaceProps<S>) {
  const s = useStore(store);
  if (device === "tv") return <Tv s={s} />;
  if (device === "ipad") return <Ipad s={s} />;
  return <Phone s={s} store={store} shot={shot} />;
}

const ALL: Scenario<S>["devices"] = ["phone", "tv", "ipad"];
const toBake: Partial<S> = { current: "rocket-crew", target: "bake-shop" };
const onBake: Partial<S> = { current: "bake-shop", previous: "rocket-crew", swap: "done", undo: true };
const duelBoard = (placed: number): S => with_({ cast: false, phone: "duel-board", duel: { games: DUELS, openId: "wd-1", placed, played: false } });

const scenarios: Scenario<S>[] = [
  { id: "home.01-friday-deck", label: "Friday 7:10: the deck (home), TV held between moments, Juneau's iPad following", flow: "home", state: "default", devices: ALL, build: () => with_({ phone: "home", tvHeld: true }) },
  { id: "home.02-first-run", label: "First run: the library is already a deck; add who's home once", flow: "home", state: "empty", devices: ["phone"], build: () => with_({ firstRun: true, cast: false, phone: "home" }) },
  { id: "home.03-later-no-cast", label: "Later, nothing cast: the spine idles (all games, turns)", flow: "home", state: "partial", devices: ["phone"], build: () => with_({ cast: false, phone: "home" }) },

  { id: "swap.01-mid-rocket", label: "Mid Rocket Crew mission 6: Captain view inside the spine; Juneau fixing", flow: "swap", state: "default", devices: ALL, build: () => with_({ phone: "game" }) },
  { id: "swap.02-deck", label: "Tap the spine's deck tab: the deck rises over the game", flow: "swap", state: "partial", devices: ["phone"], build: () => with_({ phone: "deck" }) },
  { id: "swap.03-seats", label: "Bake Shop's cover: resume day 4, seats already filled from who's here", flow: "swap", state: "partial", devices: ["phone"], build: () => with_({ phone: "seats", pick: "bake-shop" }) },
  { id: "swap.04-saving", label: "Saving mission 6: the game shrinks back into a cover on the TV", flow: "swap", state: "loading", devices: ALL, build: () => with_({ ...toBake, swap: "saving" }) },
  { id: "swap.05-tv-cutover", label: "TV cut-over: Rocket Crew filed with its save, Bake Shop comes forward", flow: "swap", state: "loading", devices: ALL, build: () => with_({ ...toBake, swap: "cutover" }) },
  { id: "swap.06-kids-follow", label: "Kid iPads follow by name: Juneau's picture rides the thread to his seat", flow: "swap", state: "loading", devices: ALL, build: () => with_({ ...toBake, swap: "following" }) },
  { id: "swap.07-bake-shop-on", label: "Bake Shop day 4: everyone in their seat, undo on the spine's ledge", flow: "swap", state: "success", devices: ALL, build: () => with_({ ...onBake, phone: "game" }) },
  { id: "swap.08-ava-didnt-follow", label: "Ava's iPad is asleep at 9%: her row says so; her seat is kept", flow: "swap", state: "interrupted", devices: ALL, build: () => with_({ ...toBake, swap: "following", avaAsleep: true, ipadOwner: "ava" }) },
  { id: "swap.09-ava-seat-kept", label: "Bake Shop on without Ava: the ledge offers one fix", flow: "swap", state: "interrupted", devices: ALL, build: () => with_({ ...onBake, phone: "game", avaAsleep: true }) },
  { id: "swap.10-ava-on-juneaus", label: "Ava's seat moves onto Juneau's iPad: two halves, hers turned to face her", flow: "swap", state: "partial", devices: ALL, build: () => with_({ ...onBake, undo: false, phone: "game", avaAsleep: true, avaOnJuneau: true }) },
  { id: "swap.11-ava-wakes", label: "Ava's iPad plugged in: it wakes straight into her Bake Shop seat", flow: "swap", state: "success", devices: ["ipad", "tv"], build: () => with_({ ...onBake, undo: false, phone: "game", ipadOwner: "ava" }) },
  { id: "swap.12-undo-saving", label: "Undo: Bake Shop saves day 4, Rocket Crew comes back", flow: "swap", state: "loading", devices: ALL, build: () => with_({ current: "bake-shop", target: "rocket-crew", previous: "rocket-crew", swap: "cutover", undone: true }) },
  { id: "swap.13-back-to-mission-6", label: "Back to Rocket Crew mission 6, right where it was", flow: "swap", state: "undone", devices: ALL, build: () => with_({ current: "rocket-crew", previous: "bake-shop", swap: "done", undone: true, phone: "game" }) },

  { id: "word-duel.01-list", label: "Word Duel's list: your turn (2), their turn (3), finished (2)", flow: "word-duel", state: "default", devices: ["phone"], build: () => with_({ cast: false, phone: "duel-list" }) },
  { id: "word-duel.02-nana", label: "Nana's game: she played QUILT for 34", flow: "word-duel", state: "default", devices: ["phone"], build: () => duelBoard(0) },
  { id: "word-duel.03-placing", label: "Placing tiles under the T", flow: "word-duel", state: "partial", devices: ["phone"], build: () => duelBoard(2) },
  { id: "word-duel.04-ready", label: "TIDE placed: Play is live", flow: "word-duel", state: "partial", devices: ["phone"], build: () => duelBoard(3) },
  { id: "word-duel.05-played", label: "Played TIDE for 14: Nana's move; next, Mom's turn", flow: "word-duel", state: "success", devices: ["phone"], build: () => with_({ cast: false, phone: "duel-board", duel: { games: afterMove(DUELS, "wd-1"), openId: "wd-1", placed: 3, played: true } }) },
  { id: "word-duel.06-list-after", label: "Back on the list: Nana's game moved to their turn; the spine shows 1", flow: "word-duel", state: "success", devices: ["phone"], build: () => with_({ cast: false, phone: "duel-list", duel: { games: afterMove(DUELS, "wd-1"), openId: "wd-1", placed: 3, played: true } }) },
  { id: "word-duel.07-new-game", label: "New game: one per opponent, from homes you already play with", flow: "word-duel", state: "default", devices: ["phone"], build: () => with_({ cast: false, phone: "duel-new" }) },
];

export const concept = defineConcept<S>({
  id: "spine",
  name: "D · Shells on a Spine",
  brief: "Every game feels like its own app; OGS is the thin spine that never changes: household, cast, turn inbox, and the deck tab that swaps games.",
  css,
  Surface,
  scenarios,
  flows: [
    {
      id: "swap",
      flow: "swap",
      label: "Rocket Crew mission 6 → Bake Shop day 4, every device",
      start: "swap.01-mid-rocket",
      steps: [
        { device: "phone", bot: "spine-deck", mark: "Dad taps the deck tab on the spine", wait: 1500 },
        { device: "phone", bot: "cover-bake-shop", mark: "Bake Shop's cover: day 4, seats already filled", wait: 1800 },
        { device: "phone", bot: "seats-swap", mark: "Swap: mission 6 saves, the TV cuts over, the iPads follow", wait: 6200 },
      ],
    },
    {
      id: "swap-undo",
      flow: "swap",
      label: "Undo: back to Rocket Crew mission 6",
      start: "swap.07-bake-shop-on",
      steps: [{ device: "phone", bot: "ledge-undo", mark: "Undo from the spine's ledge", wait: 6200 }],
    },
    {
      id: "ava-asleep",
      flow: "swap",
      label: "Ava's iPad asleep: share Juneau's",
      start: "swap.09-ava-seat-kept",
      steps: [{ device: "phone", bot: "ledge-share", mark: "Put Ava's seat on Juneau's iPad", wait: 2500 }],
    },
    {
      id: "word-duel",
      flow: "word-duel",
      label: "Word Duel: Nana's game, play TIDE, back to the list",
      start: "word-duel.01-list",
      steps: [
        { device: "phone", bot: "duel-nana", mark: "Open Nana's game (your turn)" },
        { device: "phone", bot: "tile-I", mark: "Place I under the T", wait: 700 },
        { device: "phone", bot: "tile-D", mark: "Place D", wait: 700 },
        { device: "phone", bot: "tile-E", mark: "Place E", wait: 900 },
        { device: "phone", bot: "duel-play", mark: "Play TIDE for 14", wait: 1800 },
        { device: "phone", bot: "duel-back", mark: "Back to the list: Nana's game is now their turn", wait: 2000 },
      ],
    },
  ],
});
