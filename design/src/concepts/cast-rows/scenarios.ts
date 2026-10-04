import type { Flow, Scenario } from "../../harness/types";
import { goHome, startItem } from "./actions";
import { initial, positionOf, rowsFor, type S } from "./state";

const at = (s: S, id: string): S => ({ ...s, focus: positionOf(s, id) });
const couch = (over: Partial<S> = {}): S => initial({ tonight: ["dad", "juneau", "ava"], rosterSet: true, ...over });
const item = (s: S, id: string) => rowsFor(s).flatMap((r) => r.items).find((i) => i.id === id);
const play = (s: S, id: string): S => {
  const it = item(s, id);
  return it ? startItem(at(s, id), it) : s;
};

const rocket = (): S => play(couch(), "c-rc-1");
const rocketHome = (): S => goHome(rocket());
const bake = (): S => play(rocketHome(), "c-bs-1");

export const scenarios: Scenario<S>[] = [
  // 1 · Cast first
  { id: "first-run.01-app-open", label: "Open the app: nothing cast yet. One job: put it on the TV", flow: "first-run", state: "empty", devices: ["phone", "tv", "ipad"], build: () => initial({ cast: "off" }) },
  { id: "first-run.02-pick-tv", label: "Cast to: the living room TV (bedroom TV is off)", flow: "first-run", state: "default", devices: ["phone"], build: () => initial({ cast: "picking" }) },
  { id: "first-run.03-no-tv", label: "No TV found: three specific checks, one retry", flow: "first-run", state: "error", devices: ["phone"], build: () => initial({ cast: "none-found" }) },
  { id: "first-run.04-connecting", label: "Connecting: the TV boots the launcher", flow: "first-run", state: "loading", devices: ["phone", "tv"], build: () => initial({ cast: "connecting" }) },
  { id: "first-run.05-launcher-ready", label: "The launcher on the TV before anyone picks anything; the phone is the remote", flow: "first-run", state: "success", devices: ["phone", "tv", "ipad"], build: () => initial({ fresh: true }) },

  // 2 · Driving the launcher
  { id: "home.01-browse-touch-bake", label: "Browse on the phone: touching Bake Shop focuses it on the TV", flow: "home", state: "default", devices: ["phone", "tv"], build: () => at(initial(), "c-bs-1") },
  { id: "home.02-remote", label: "Remote one tap away: touchpad, OK, back, home, keyboard", flow: "home", state: "default", devices: ["phone", "tv"], build: () => initial({ mode: "remote" }) },
  { id: "home.03-remote-your-turn", label: "Remote: focus down to Your turn (Word Duel, played on phones)", flow: "home", state: "default", devices: ["phone", "tv"], build: () => at(initial({ mode: "remote" }), "d-wd-1") },
  { id: "home.04-couch-games", label: "Couch games row: Peekaboo Garden focused", flow: "home", state: "default", devices: ["tv"], build: () => at(initial({ mode: "remote" }), "g-peekaboo-garden") },
  { id: "home.05-game-nights", label: "Game nights row: Hearthisle, three homes, tonight 8 pm", flow: "home", state: "default", devices: ["phone", "tv"], build: () => at(initial(), "n-hi-1") },
  { id: "home.06-library", label: "Library row: every game, A to Z", flow: "home", state: "default", devices: ["tv"], build: () => at(initial({ mode: "remote" }), "l-story-nook") },
  { id: "home.07-detail", label: "Rocket Crew's page on the TV: resume point, who played, Continue / New", flow: "home", state: "default", devices: ["phone", "tv"], build: () => initial({ mode: "remote", tv: "detail" }) },
  { id: "home.08-keyboard", label: "Remote keyboard: type into the TV's search", flow: "home", state: "default", devices: ["phone"], build: () => initial({ mode: "remote", keyboard: true }) },

  // 3 · Who's playing
  { id: "tonight.01-who", label: "Who's playing? Asked once a night, before the first couch game", flow: "tonight", state: "default", devices: ["phone", "tv", "ipad"], build: () => initial({ tv: "who", mode: "remote" }) },
  { id: "tonight.02-who-juneau", label: "Juneau picked: his iPad lights up", flow: "tonight", state: "partial", devices: ["phone", "tv", "ipad"], build: () => initial({ tv: "who", tonight: ["dad", "juneau"], whoFocus: 3 }) },
  { id: "tonight.03-who-ready", label: "Everyone picked, on the phone: Start", flow: "tonight", state: "success", devices: ["phone", "tv", "ipad"], build: () => initial({ tv: "who", tonight: ["dad", "juneau", "ava"], whoFocus: 4, ipadSeat: "ava" }) },

  // 4 · Launch, play, Home, swap
  { id: "swap.01-rocket-playing", label: "Rocket Crew mission 6: TV game, phone Captain + Home, Juneau Fixer", flow: "swap", state: "default", devices: ["phone", "tv", "ipad"], build: rocket },
  { id: "swap.02-ava-helper", label: "Ava's iPad in Rocket Crew: one giant helper button", flow: "swap", state: "default", devices: ["ipad"], build: () => ({ ...rocket(), ipadSeat: "ava" }) },
  { id: "swap.03-home", label: "Home: Rocket Crew suspended at mission 6, TV back on the shelf, same stream", flow: "swap", state: "interrupted", devices: ["phone", "tv", "ipad"], build: rocketHome },
  { id: "swap.04-touch-bake", label: "Touch Bake Shop on the phone: the TV shows day 4", flow: "swap", state: "default", devices: ["phone", "tv"], build: () => at(rocketHome(), "c-bs-1") },
  { id: "swap.05-bake-playing", label: "Bake Shop day 4 in the same stream; Juneau's iPad is the Baker", flow: "swap", state: "success", devices: ["phone", "tv", "ipad"], build: bake },
  { id: "swap.06-bake-ava", label: "Ava's iPad followed by name: littlest helper", flow: "swap", state: "success", devices: ["ipad"], build: () => ({ ...bake(), ipadSeat: "ava" }) },

  // 5 · Your turn
  { id: "word-duel.01-on-tv", label: "Your turn row on the TV: Nana played QUILT", flow: "word-duel", state: "default", devices: ["phone", "tv"], build: () => at(initial(), "d-wd-1") },
  { id: "word-duel.02-handoff", label: "Selected: the TV says it's on your phone, never shows your tiles", flow: "word-duel", state: "default", devices: ["phone", "tv"], build: () => play(initial(), "d-wd-1") },
  { id: "word-duel.03-placed", label: "TOWN placed on the phone", flow: "word-duel", state: "partial", devices: ["phone"], build: () => {
    const s = play(initial(), "d-wd-1");
    return s.duel ? { ...s, duel: { ...s.duel, placed: ["O", "W", "N"] } } : s;
  } },
  { id: "word-duel.04-sent", label: "Sent: one more your-turn waiting (Mom)", flow: "word-duel", state: "success", devices: ["phone", "tv"], build: () => {
    const s = play(initial(), "d-wd-1");
    return s.duel ? { ...s, duel: { ...s.duel, placed: ["O", "W", "N"], sent: true }, duelsDone: ["wd-1"] } : s;
  } },

  // 6 · Edges
  { id: "failure.01-remote-asleep", label: "Jonathan's phone slept: Mom's phone offers the remote", flow: "failure", state: "interrupted", devices: ["phone", "tv"], build: () => initial({ phoneOwner: "mom", remoteAsleep: true }) },
  { id: "failure.02-remote-taken", label: "Mom has the remote: nothing on the TV changed", flow: "failure", state: "success", devices: ["phone", "tv"], build: () => initial({ phoneOwner: "mom", remoteHolder: "mom" }) },
  { id: "failure.03-asleep-in-game", label: "Mid-game, the Captain's phone slept: Mom takes the controls", flow: "failure", state: "interrupted", devices: ["phone", "tv"], build: () => ({ ...rocket(), phoneOwner: "mom", remoteAsleep: true }) },
  { id: "failure.04-cast-dropped", label: "The cast dropped mid-game: paused, iPads wait, one action", flow: "failure", state: "error", devices: ["phone", "tv", "ipad"], build: () => ({ ...rocket(), cast: "dropped", before: "game" }) },
  { id: "failure.05-recasting", label: "Casting again", flow: "failure", state: "loading", devices: ["phone", "tv"], build: () => ({ ...rocket(), cast: "connecting", recast: true, before: "game" }) },
  { id: "failure.06-resumed", label: "Back in the same game at mission 6", flow: "failure", state: "success", devices: ["phone", "tv", "ipad"], build: () => ({ ...rocket(), resumed: true }) },
  { id: "failure.07-dropped-launcher", label: "Dropped on the shelf: re-cast lands on the same focus", flow: "failure", state: "error", devices: ["phone"], build: () => ({ ...at(initial(), "c-bs-1"), cast: "dropped", before: "launcher" }) },
];

export const flows: Flow[] = [
  {
    id: "cast-first",
    flow: "first-run",
    label: "Cast first: open the app, cast, the TV becomes the launcher",
    start: "first-run.01-app-open",
    steps: [
      { device: "phone", bot: "cast", mark: "Open Game, tap Cast to a TV" },
      { device: "phone", bot: "pick-living", mark: "Pick the living room TV: the TV boots the launcher", wait: 3200 },
      { device: "phone", bot: "item-c-bs-1", mark: "Touch a game on the phone: the TV follows", wait: 1800 },
    ],
  },
  {
    id: "launch",
    flow: "tonight",
    label: "Launch with the remote: Rocket Crew, who's playing, start",
    start: "first-run.05-launcher-ready",
    steps: [
      { device: "phone", bot: "mode-remote", mark: "Switch the phone to Remote" },
      { device: "phone", bot: "pad-right", mark: "Right: focus moves to Bake Shop, the hero follows" },
      { device: "phone", bot: "pad-left", mark: "Left: back to Rocket Crew" },
      { device: "phone", bot: "pad-ok", mark: "OK: Rocket Crew's page" },
      { device: "phone", bot: "pad-ok", mark: "OK on Continue Mission 6: who's playing?" },
      { device: "phone", bot: "pad-ok", mark: "OK: Juneau's in, his iPad lights up" },
      { device: "phone", bot: "pad-right", mark: "Right to Ava" },
      { device: "phone", bot: "pad-ok", mark: "OK: Ava's in, her iPad lights up" },
      { device: "phone", bot: "pad-down", mark: "Down to Start" },
      { device: "phone", bot: "pad-ok", mark: "Start: mission 6 on the TV, controllers on every device", wait: 2400 },
    ],
  },
  {
    id: "swap",
    flow: "swap",
    label: "Swap: Rocket Crew → Home → Bake Shop, same stream, 3 phone taps, 0 kid taps",
    start: "swap.01-rocket-playing",
    steps: [
      { device: "phone", bot: "home", mark: "Home: Rocket Crew saves at mission 6, the TV is the shelf again", wait: 2200 },
      { device: "phone", bot: "item-c-bs-1", mark: "Touch Bake Shop: the TV shows day 4" },
      { device: "phone", bot: "play-c-bs-1", mark: "Continue Day 4: same stream, iPads follow by name", wait: 2600 },
    ],
  },
  {
    id: "word-duel",
    flow: "word-duel",
    label: "Your turn on the TV, played on the phone",
    start: "first-run.05-launcher-ready",
    steps: [
      { device: "phone", bot: "item-d-wd-1", mark: "Touch Nana's game: the TV focuses Your turn" },
      { device: "phone", bot: "play-d-wd-1", mark: "Play on this phone: the TV says so, shows no tiles" },
      { device: "phone", bot: "tile-O", mark: "Place O, W, N under the T of QUILT", wait: 600 },
      { device: "phone", bot: "tile-W", wait: 600 },
      { device: "phone", bot: "tile-N", wait: 900 },
      { device: "phone", bot: "duel-send", mark: "Play TOWN for 16" },
      { device: "phone", bot: "duel-done", mark: "Back to the TV: Mom's game is next in Your turn", wait: 2000 },
    ],
  },
  {
    id: "recast",
    flow: "failure",
    label: "The cast drops mid-game: cast again, back at mission 6",
    start: "failure.04-cast-dropped",
    steps: [{ device: "phone", bot: "recast", mark: "Cast again: same game, same mission, iPads unpause", wait: 3600 }],
  },
  {
    id: "remote-handover",
    flow: "failure",
    label: "Jonathan's phone sleeps: Mom picks up the remote",
    start: "failure.01-remote-asleep",
    steps: [{ device: "phone", bot: "take-remote", mark: "Mom: Take the remote", wait: 2000 }],
  },
];
