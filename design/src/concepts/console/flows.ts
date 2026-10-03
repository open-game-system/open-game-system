import type { Flow } from "../../harness/types";

export const flows: Flow[] = [
  {
    id: "home",
    flow: "home",
    label: "Console home: the phone is the remote",
    start: "home.02-tv-console-home",
    steps: [
      { device: "phone", bot: "act-bake-shop", mark: "Tap Bake Shop on the phone: the TV home turns to it", wait: 1800 },
      { device: "phone", bot: "play-on-tv", mark: "Play on TV: day 4 opens, Juneau's iPad drops into his seat", wait: 2400 },
    ],
  },
  {
    id: "swap",
    flow: "swap",
    label: "Rocket Crew mission 6 → Bake Shop day 4, every device",
    start: "swap.01-mid-rocket-crew",
    steps: [
      { device: "phone", bot: "console-home", mark: "Dad presses the console button: Rocket Crew pauses on the TV, the next games come up", wait: 1800 },
      { device: "phone", bot: "next-bake-shop", mark: "Picks Bake Shop: mission 6 saves, the TV cuts over, Juneau's iPad follows on its own", wait: 5600 },
    ],
  },
  {
    id: "swap-undo",
    flow: "swap",
    label: "Changed our minds: back to Rocket Crew",
    start: "swap.06-everyone-in",
    steps: [{ device: "phone", bot: "undo-switch", mark: "Back to it: Bake Shop saves day 4, mission 6 resumes everywhere", wait: 5600 }],
  },
  {
    id: "word-duel",
    flow: "word-duel",
    label: "Word Duel: Nana's game, play CRANE, back to the list",
    start: "word-duel.01-list",
    steps: [
      { device: "phone", bot: "duel-wd-1", mark: "Your turn against Nana" },
      { device: "phone", bot: "rack-C", mark: "Tap tiles into the glowing squares", wait: 700 },
      { device: "phone", bot: "rack-R", wait: 700 },
      { device: "phone", bot: "rack-A", wait: 700 },
      { device: "phone", bot: "rack-N", mark: "CRANE on the triple word: 27", wait: 1200 },
      { device: "phone", bot: "play", mark: "Play it. Sent to Nana; Mom's game is next", wait: 1800 },
      { device: "phone", bot: "all-games", mark: "Back to the list: Nana's game is now waiting on her" },
    ],
  },
];
