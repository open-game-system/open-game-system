import type { Flow } from "../../harness/types";

export const flows: Flow[] = [
  {
    id: "swap",
    flow: "swap",
    label: "Cut from Rocket Crew to Bake Shop",
    start: "swap.01-mid-game",
    steps: [
      { device: "phone", bot: "director", mark: "Dad taps Next: tonight's running order, Bake Shop lined up", wait: 2200 },
      { device: "phone", bot: "cut", mark: "Cut to Bake Shop: Rocket Crew saves, the TV idents, iPads follow", wait: 7200 },
      { device: "ipad", bot: "kid-strawberry", mark: "Juneau is already baking: no code, no role pick", wait: 1600 },
    ],
  },
  {
    id: "swap-back",
    flow: "swap",
    label: "Undo: back to Rocket Crew",
    start: "swap.07-on-air",
    steps: [{ device: "phone", bot: "undo", mark: "Back to it: Rocket Crew resumes at mission 6", wait: 7200 }],
  },
  {
    id: "word-duel",
    flow: "word-duel",
    label: "Word Duel: play Nana's turn",
    start: "word-duel.01-list",
    steps: [
      { device: "phone", bot: "duel-wd-1", mark: "Your turn: open Nana's game (she played QUILT)" },
      { device: "phone", bot: "rack-O", mark: "Lay TONE down from her T", wait: 700 },
      { device: "phone", bot: "rack-N", wait: 700 },
      { device: "phone", bot: "rack-E", wait: 900 },
      { device: "phone", bot: "play", mark: "Play TONE for 12", wait: 1800 },
      { device: "phone", bot: "back-list-sent", mark: "Back to the list: Nana's game moved to Their turn" },
    ],
  },
];
