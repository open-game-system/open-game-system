import type { Flow } from "../../harness/types";

export const flows: Flow[] = [
  {
    id: "cast-first",
    flow: "first-run",
    label: "Open OGS → cast → the TV becomes the launcher",
    start: "first-run.01-open-app",
    steps: [
      { device: "phone", bot: "cast-open", mark: "Open OGS: the first thing is the TV. Cast to a TV" },
      { device: "phone", bot: "tv-living", mark: "Living room TV: OGS starts in the cloud and streams to it; the phone turns into the remote", wait: 3600 },
      { device: "phone", bot: "pad-right", mark: "First touch: the focus moves along the icon row, the whole TV becomes that game's hub", wait: 1800 },
    ],
  },
  {
    id: "launch",
    flow: "tonight",
    label: "Pick and start Rocket Crew mission 6 with the touchpad",
    start: "home.01-remote",
    steps: [
      { device: "phone", bot: "pad-right", mark: "Click right on the glass: Word Duel's hub (your turns)", wait: 1600 },
      { device: "phone", bot: "pad-left", mark: "Back to Rocket Crew", wait: 1400 },
      { device: "phone", bot: "pad-down", mark: "Down to Continue · Mission 6 (the phone says what a click will do)", wait: 1400 },
      { device: "phone", bot: "pad-select", mark: "Click: who's playing. Tonight's crew is already in; Juneau's and Ava's iPads light up", wait: 2200 },
      { device: "phone", bot: "pad-select", mark: "Start: mission 6 in the same stream; the phone becomes the Captain controller", wait: 2400 },
    ],
  },
  {
    id: "swap",
    flow: "swap",
    label: "In Rocket Crew → Home → Bake Shop day 4: 2 phone taps, 0 kid taps, no recast",
    start: "tonight.04-rocket-running",
    steps: [
      { device: "phone", bot: "home", mark: "Home: Rocket Crew suspends at mission 6; the control centre slides up over it", wait: 2200 },
      { device: "phone", bot: "pad-select", mark: "Click: Bake Shop day 4 is already focused. Same stream, the iPads follow by name", wait: 4200 },
    ],
  },
  {
    id: "word-duel",
    flow: "word-duel",
    label: "Your turn on the TV → play it on the phone",
    start: "home.01-remote",
    steps: [
      { device: "phone", bot: "pad-right", mark: "Word Duel's hub: two turns waiting, from Nana and Mom", wait: 1600 },
      { device: "phone", bot: "pad-down", mark: "Down to the turn cards", wait: 1400 },
      { device: "phone", bot: "pad-select", mark: "Click Nana's turn: the board opens on the phone; the TV shows only the score", wait: 2200 },
      { device: "phone", bot: "wd-play", mark: "Play TONAL for 26 on the phone", wait: 2000 },
      { device: "phone", bot: "wd-done", mark: "Back to the TV: one turn left (Mom)", wait: 1800 },
    ],
  },
  {
    id: "list",
    flow: "home",
    label: "Browse on the phone instead: tap the list, the TV follows",
    start: "home.01-remote",
    steps: [
      { device: "phone", bot: "mode-browse", mark: "Switch the remote to a list on the phone", wait: 1400 },
      { device: "phone", bot: "browse-bake-shop", mark: "Tap Bake Shop: the TV turns to its hub", wait: 1600 },
      { device: "phone", bot: "browse-act-continue", mark: "Continue · Day 4: who's playing on the TV and on the phone", wait: 1800 },
      { device: "phone", bot: "pick-start", mark: "Start", wait: 2200 },
    ],
  },
  {
    id: "remote-handoff",
    flow: "failure",
    label: "Jonathan's phone sleeps: Mom picks up the remote",
    start: "failure.01-remote-asleep",
    steps: [{ device: "phone", bot: "take-remote", mark: "Mom takes the remote: one tap, the TV says so", wait: 2200 }],
  },
  {
    id: "recast",
    flow: "failure",
    label: "The cast drops: cast again resumes mission 6",
    start: "failure.03-cast-dropped",
    steps: [{ device: "phone", bot: "recast", mark: "Cast again: OGS comes back at mission 6; the iPads drop back in", wait: 3600 }],
  },
];
