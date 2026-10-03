import type { Flow } from "../../harness/types";

export const flows: Flow[] = [
  {
    id: "swap",
    flow: "swap",
    label: "Rocket Crew → Bake Shop on every device: 2 taps, zero on the iPads",
    start: "swap.01-mid-game",
    steps: [
      { device: "phone", bot: "switch-game", mark: "Dad taps Switch: the game keeps running behind the sheet" },
      { device: "phone", bot: "pick-bake-shop", mark: "Bake Shop, day 4: seats already filled, so one tap swaps", wait: 6200 },
      { device: "ipad", bot: "bake-strawberry", mark: "Juneau's iPad followed by itself: he frosts straight away", wait: 1800 },
      { device: "phone", bot: "undo", mark: "Undo: back to Rocket Crew, mission 6 exactly as it was", wait: 6000 },
    ],
  },
  {
    id: "word-duel",
    flow: "word-duel",
    label: "Word Duel: Nana's move, LOFT for 14, back to the list",
    start: "word-duel.01-list",
    steps: [
      { device: "phone", bot: "duel-wd-1", mark: "Your move ×2: open Nana's game" },
      { device: "phone", bot: "tile-O", mark: "Place O under the L of QUILT", wait: 700 },
      { device: "phone", bot: "tile-F", mark: "F", wait: 700 },
      { device: "phone", bot: "tile-T", mark: "T: LOFT" },
      { device: "phone", bot: "play-move", mark: "Play LOFT for 14" },
      { device: "phone", bot: "all-games", mark: "Back to all games: Nana's moves to Their move" },
    ],
  },
];
