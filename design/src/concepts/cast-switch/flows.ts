import type { Flow } from "../../harness/types";

export const flows: Flow[] = [
  {
    id: "cast-first",
    flow: "first-run",
    label: "Cast first: open OGS, cast, the TV becomes the console home",
    start: "first-run.01-open",
    steps: [
      { device: "phone", bot: "cast", mark: "Open OGS. Nothing on the TV yet: tap Cast to TV", wait: 1200 },
      { device: "phone", bot: "tv-living", mark: "Pick the living room TV: the TV boots the OGS home", wait: 3400 },
      { device: "phone", bot: "r-right", mark: "The phone is now a remote. Right on the d-pad: focus moves on the TV", wait: 1300 },
      { device: "phone", bot: "got-it", mark: "Got it. The iPads already sit on the couch, waiting", wait: 1400 },
    ],
  },
  {
    id: "launch",
    flow: "tonight",
    label: "Pick and start Rocket Crew with the remote (who's playing on the TV)",
    start: "first-run.05-launcher-fresh",
    steps: [
      { device: "phone", bot: "r-right", mark: "Right: Bake Shop", wait: 1000 },
      { device: "phone", bot: "r-left", mark: "Left: back to Rocket Crew, paused at mission 6", wait: 1200 },
      { device: "phone", bot: "r-a", mark: "A: Rocket Crew's page on the TV", wait: 1600 },
      { device: "phone", bot: "r-a", mark: "A on Continue: who's playing? Last crew is picked; Juneau's iPad lights up", wait: 1800 },
      { device: "phone", bot: "r-left", mark: "Left to Ava", wait: 900 },
      { device: "phone", bot: "r-a", mark: "A: Ava joins as helper; her iPad lights up", wait: 1600 },
      { device: "phone", bot: "r-down", mark: "Down to Start", wait: 900 },
      { device: "phone", bot: "r-a", mark: "Start: Rocket Crew opens in the same stream; phone is Captain, iPads get their pads", wait: 3800 },
    ],
  },
  {
    id: "swap",
    flow: "swap",
    label: "Swap: Rocket Crew mission 6 → Home → Bake Shop day 4 (4 taps, 0 kid taps, 0 recasts)",
    start: "swap.01-playing-rocket",
    steps: [
      { device: "phone", bot: "home", mark: "Home: the TV returns to the launcher, Rocket Crew suspended at mission 6; iPads pause", wait: 2200 },
      { device: "phone", bot: "r-right", mark: "Right: Bake Shop, day 4 · 3 of 5 orders", wait: 1500 },
      { device: "phone", bot: "r-a", mark: "A: Bake Shop's page; tonight's crew is already on it", wait: 1600 },
      { device: "phone", bot: "r-a", mark: "A on Continue: mission 6 saved, Bake Shop starts in the same stream; iPads follow by name", wait: 4200 },
    ],
  },
  {
    id: "swap-list",
    flow: "swap",
    label: "The same swap from List mode (3 taps)",
    start: "swap.01-playing-rocket",
    steps: [
      { device: "phone", bot: "home", mark: "Home", wait: 1600 },
      { device: "phone", bot: "mode-list", mark: "List: the TV row as tiles on the phone", wait: 1300 },
      { device: "phone", bot: "b-bake-shop", mark: "Tap Bake Shop: its page opens on the TV and the phone", wait: 1600 },
      { device: "phone", bot: "b-continue", mark: "Continue: day 4 in the same stream; iPads follow", wait: 4000 },
    ],
  },
  {
    id: "word-duel",
    flow: "word-duel",
    label: "Your turn on the TV → play it on the phone",
    start: "home.01-remote",
    steps: [
      { device: "phone", bot: "r-down", mark: "Down: Your turn has a 2", wait: 1300 },
      { device: "phone", bot: "r-a", mark: "A: the two turns on the TV (who, last move, score; never your letters)", wait: 1800 },
      { device: "phone", bot: "r-a", mark: "A on Nana: the board opens on the phone; the TV only says a turn is happening", wait: 2000 },
      { device: "phone", bot: "duel-play", mark: "Play WAVE: sent to Nana; Mom's turn is next on the TV", wait: 2000 },
    ],
  },
  {
    id: "remote-handover",
    flow: "failure",
    label: "Jonathan's phone sleeps; Mom picks up the remote",
    start: "failure.02-mom-offer",
    steps: [
      { device: "phone", bot: "take-remote", mark: "Mom: Take the remote. The TV says it's Mom's now", wait: 1600 },
      { device: "phone", bot: "r-right", mark: "Her d-pad moves the same focus", wait: 1400 },
    ],
  },
  {
    id: "recast",
    flow: "failure",
    label: "The cast drops; cast again resumes Rocket Crew at mission 6",
    start: "failure.04-cast-dropped",
    steps: [{ device: "phone", bot: "recast", mark: "Cast again: the TV picks up mission 6, the iPads drop back into their pads", wait: 4200 }],
  },
];
