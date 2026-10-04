import type { Scenario } from "../../harness/types";
import { rowIndex } from "./data";
import { base, type S } from "./state";

const RC = "rocket-crew";
const BS = "bake-shop";
const WD = "word-duel";
const MISSION = { [RC]: "Mission 6 · Navigator rank" };

export const scenarios: Scenario<S>[] = [
  // 1 · cast first
  { id: "first-run.01-open-app", label: "Open OGS: nothing cast yet", flow: "first-run", state: "empty", devices: ["phone", "tv", "ipad"], build: () => base({ cast: "none" }) },
  { id: "first-run.02-pick-tv", label: "Cast → pick the living room TV", flow: "first-run", state: "default", devices: ["phone"], build: () => base({ cast: "picking" }) },
  { id: "first-run.03-no-tv", label: "No TV found on this Wi-Fi", flow: "first-run", state: "error", devices: ["phone"], build: () => base({ cast: "no-tv" }) },
  { id: "first-run.04-connecting", label: "Connecting: OGS starts on the TV", flow: "first-run", state: "loading", devices: ["phone", "tv", "ipad"], build: () => base({ cast: "connecting" }) },
  { id: "first-run.05-launcher-fresh", label: "Launcher on the TV, nobody has picked anything; phone is the remote", flow: "first-run", state: "success", devices: ["tv", "phone", "ipad"], build: () => base({ fresh: true }) },

  // 2 · driving the launcher
  { id: "home.01-remote", label: "Remote: focus on the icon row (Rocket Crew hub)", flow: "home", state: "default", devices: ["tv", "phone", "ipad"], build: () => base() },
  { id: "home.02-focus-continue", label: "Remote: focus down on Continue", flow: "home", state: "default", devices: ["tv", "phone"], build: () => base({ zone: "actions" }) },
  { id: "home.03-focus-card", label: "Remote: focus on an activity card", flow: "home", state: "default", devices: ["tv", "phone"], build: () => base({ zone: "cards", zi: 1 }) },
  { id: "home.04-list-on-phone", label: "List mode: browse on the phone, the TV follows", flow: "home", state: "default", devices: ["phone", "tv"], build: () => base({ phoneMode: "browse", zone: "actions" }) },
  { id: "home.05-story-nook-hub", label: "Story Nook hub: Juneau's character is ready", flow: "home", state: "default", devices: ["tv", "phone"], build: () => base({ row: rowIndex("story-nook") }) },
  { id: "home.06-game-night-hub", label: "Hearthisle hub: game night paused at turn 14", flow: "home", state: "default", devices: ["tv"], build: () => base({ row: rowIndex("hearthisle"), zone: "cards", zi: 1 }) },
  { id: "home.07-bake-shop-hub", label: "Bake Shop hub: paused Tuesday at day 4", flow: "home", state: "default", devices: ["tv"], build: () => base({ row: rowIndex(BS) }) },

  // 3 · who's playing
  { id: "tonight.01-whos-playing", label: "Who's playing Rocket Crew: the kids' iPads light up", flow: "tonight", state: "default", devices: ["tv", "phone", "ipad"], build: () => base({ tv: { kind: "picker", gameId: RC, fresh: false }, pickI: 4 }) },
  { id: "tonight.02-ava-left-out", label: "Who's playing: Ava left out, her iPad stays resting", flow: "tonight", state: "partial", devices: ["tv", "phone", "ipad"], build: () => base({ tv: { kind: "picker", gameId: RC, fresh: false }, pickI: 3, playing: ["dad", "juneau"] }) },
  { id: "tonight.03-picker-on-phone", label: "Who's playing, in list mode on the phone", flow: "tonight", state: "default", devices: ["phone"], build: () => base({ phoneMode: "browse", tv: { kind: "picker", gameId: RC, fresh: false }, pickI: 4 }) },
  { id: "tonight.04-rocket-running", label: "Rocket Crew mission 6 running: Captain phone, Fixer iPads", flow: "tonight", state: "success", devices: ["tv", "phone", "ipad"], build: () => base({ tv: { kind: "game", gameId: RC } }) },

  // 4 · launch → play → Home → swap
  { id: "swap.01-control-centre", label: "Home pressed: control centre over the suspended game", flow: "swap", state: "default", devices: ["tv", "phone", "ipad"], build: () => base({ tv: { kind: "control", gameId: RC }, ccI: 1 }) },
  { id: "swap.02-control-on-phone", label: "Control centre in list mode on the phone", flow: "swap", state: "default", devices: ["phone"], build: () => base({ phoneMode: "browse", tv: { kind: "control", gameId: RC } }) },
  { id: "swap.03-switching", label: "Switching in the same stream: Rocket Crew saved, Bake Shop day 4 loads, iPads follow", flow: "swap", state: "loading", devices: ["tv", "phone", "ipad"], build: () => base({ tv: { kind: "switching", from: RC, to: BS }, suspended: MISSION, row: rowIndex(BS) }) },
  { id: "swap.04-bake-running", label: "Bake Shop day 4 running: no recast, no kid taps", flow: "swap", state: "success", devices: ["tv", "phone", "ipad"], build: () => base({ tv: { kind: "game", gameId: BS }, suspended: MISSION, row: rowIndex(BS) }) },
  { id: "swap.05-launcher-suspended", label: "Home twice: launcher with Rocket Crew suspended at mission 6", flow: "swap", state: "partial", devices: ["tv", "phone"], build: () => base({ suspended: MISSION }) },

  // 5 · your turn on the launcher
  { id: "word-duel.01-your-turn", label: "Word Duel hub: two of your turns on the TV", flow: "word-duel", state: "default", devices: ["tv", "phone"], build: () => base({ row: rowIndex(WD), zone: "cards", zi: 0 }) },
  { id: "word-duel.02-on-phone", label: "Handed off: the board is on the phone, the TV shows only the score", flow: "word-duel", state: "default", devices: ["tv", "phone", "ipad"], build: () => base({ row: rowIndex(WD), tv: { kind: "handoff", duelId: "wd-1", played: false } }) },
  { id: "word-duel.03-played", label: "Played TONAL: sent to Nana", flow: "word-duel", state: "success", devices: ["tv", "phone"], build: () => base({ row: rowIndex(WD), tv: { kind: "handoff", duelId: "wd-1", played: true } }) },
  { id: "word-duel.04-one-left", label: "Back on the launcher: one turn left (Mom)", flow: "word-duel", state: "partial", devices: ["tv"], build: () => base({ row: rowIndex(WD), zone: "cards", zi: 0, duelsPlayed: ["wd-1"] }) },

  // 6 · edge
  { id: "failure.01-remote-asleep", label: "Jonathan's phone sleeps: Mom's phone can take the remote", flow: "failure", state: "interrupted", devices: ["phone", "tv"], build: () => base({ phone: "mom", remote: "dad", remoteAsleep: true, suspended: MISSION, notice: "Jonathan's phone went to sleep · any grown-up's phone can take the remote" }) },
  { id: "failure.02-mom-has-remote", label: "Mom has the remote", flow: "failure", state: "success", devices: ["phone", "tv"], build: () => base({ phone: "mom", remote: "mom", suspended: MISSION, notice: "Mom has the remote" }) },
  { id: "failure.03-cast-dropped", label: "The cast drops mid-game: everything waits at mission 6", flow: "failure", state: "error", devices: ["phone", "tv", "ipad"], build: () => base({ cast: "dropped", tv: { kind: "game", gameId: RC } }) },
  { id: "failure.04-recasting", label: "Cast again: the TV picks up at mission 6", flow: "failure", state: "loading", devices: ["phone", "tv", "ipad"], build: () => base({ cast: "recasting", tv: { kind: "game", gameId: RC } }) },
];
