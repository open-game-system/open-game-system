import type { Flow } from "../../harness/types";

export const FLOWS: Flow[] = [
  {
    id: "cast-first",
    flow: "first-run",
    label: "Open OGS, put the living room on the TV",
    start: "first-run.01-open",
    steps: [
      { device: "phone", bot: "cast", mark: "1 tap: Put it on the TV" },
      { device: "phone", bot: "tv-living", mark: "2: the living room TV. The room lights up on the TV", wait: 3200 },
      { device: "phone", bot: "right", mark: "The phone is the remote: the spotlight moves" },
      { device: "phone", bot: "mini-night", mark: "Or tap the room on the phone: game night opens on the TV" },
      { device: "phone", bot: "back", mark: "Back to the room" },
    ],
  },
  {
    id: "launch",
    flow: "tonight",
    label: "Pick Rocket Crew with the remote and start mission 6",
    start: "first-run.06-room-fresh",
    steps: [
      { device: "phone", bot: "right", mark: "Remote right: spotlight on Bake Shop" },
      { device: "phone", bot: "left", mark: "Left: back to Rocket Crew" },
      { device: "phone", bot: "ok", mark: "OK: the box opens. Mission 6, who's playing" },
      { device: "phone", bot: "who-ava", mark: "Seat Ava: her iPad lights up", wait: 1800 },
      { device: "phone", bot: "ok", mark: "OK: Continue mission 6. Every device follows", wait: 2200 },
      { device: "ipad", seat: "juneau", bot: "pad-1", mark: "Juneau's Fixer pads" },
    ],
  },
  {
    id: "swap",
    flow: "swap",
    label: "Swap Rocket Crew for Bake Shop: 3 phone taps, 0 kid taps, no recast",
    start: "swap.01-playing-rocket",
    steps: [
      { device: "phone", bot: "home", mark: "1: Home. Rocket Crew folds back into its box at Mission 6", wait: 2200 },
      { device: "phone", bot: "mini-bake-shop", mark: "2: tap Bake Shop in the room. Day 4 opens on the TV", wait: 2000 },
      { device: "phone", bot: "continue", mark: "3: Continue day 4. Same stream; iPads follow by name", wait: 2400 },
    ],
  },
  {
    id: "word-duel",
    flow: "word-duel",
    label: "Your turn on the cork board, played on the phone",
    start: "home.01-room",
    steps: [
      { device: "phone", bot: "mini-wd-1", mark: "Tap Nana's note: the TV takes it down, tiles go to the phone" },
      { device: "phone", bot: "tile-1", mark: "Your tiles stay on your phone" },
      { device: "phone", bot: "tile-5" },
      { device: "phone", bot: "tile-4" },
      { device: "phone", bot: "play", mark: "Play TAME: the note goes back up as waiting", wait: 2000 },
    ],
  },
  {
    id: "remote-pickup",
    flow: "failure",
    label: "Jonathan's phone sleeps: Mom picks up the remote",
    start: "failure.01-remote-asleep",
    steps: [
      { device: "phone", bot: "take-remote", mark: "Mom's phone: Pick up the remote" },
      { device: "phone", bot: "mini-bake-shop", mark: "She drives the same room" },
    ],
  },
  {
    id: "recast",
    flow: "failure",
    label: "The cast drops mid-mission, re-cast lands back at Mission 6",
    start: "failure.04-cast-dropped",
    steps: [{ device: "phone", bot: "recast", mark: "One tap: the TV comes back in the game, iPads never moved", wait: 3200 }],
  },
  {
    id: "remote-modes",
    flow: "home",
    label: "Room on top, remote below, or just the remote",
    start: "home.01-room",
    steps: [
      { device: "phone", bot: "layout-remote", mark: "Just the remote: eyes on the TV" },
      { device: "phone", bot: "right", mark: "Right" },
      { device: "phone", bot: "up", mark: "Up: the window" },
      { device: "phone", bot: "layout-both", mark: "Show the room again" },
      { device: "phone", bot: "mini-story-nook", mark: "Tap Story Nook in the room" },
    ],
  },
];
