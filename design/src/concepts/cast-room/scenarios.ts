import type { Scenario } from "../../harness/types";
import { base, initialSaves, type S } from "./state";

const ALL = ["tv", "phone", "ipad"] as const satisfies readonly ("tv" | "phone" | "ipad")[];
const all = () => [...ALL];

const playingRocket = (over: Partial<S> = {}): S => {
  const saves = initialSaves();
  const rc = saves["rocket-crew"];
  return base({
    view: { kind: "game", gameId: "rocket-crew" },
    crew: ["dad", "juneau", "ava"],
    saves: rc ? { ...saves, "rocket-crew": { ...rc, when: "Playing now", crew: ["dad", "juneau", "ava"] } } : saves,
    ...over,
  });
};

const pausedRocket = (over: Partial<S> = {}): S => {
  const saves = initialSaves();
  const rc = saves["rocket-crew"];
  return base({
    saves: rc ? { ...saves, "rocket-crew": { ...rc, when: "Paused just now", crew: ["dad", "juneau", "ava"] } } : saves,
    note: "Rocket Crew paused at Mission 6",
    ...over,
  });
};

export const SCENARIOS: Scenario<S>[] = [
  // 1. Cast first
  { id: "first-run.01-open", label: "Open OGS: nothing on the TV yet", flow: "first-run", state: "empty", devices: all(), build: () => base({ cast: "off" }) },
  { id: "first-run.02-pick-tv", label: "Which TV?", flow: "first-run", state: "default", devices: ["phone"], build: () => base({ cast: "picking" }) },
  { id: "first-run.03-searching", label: "Looking for TVs", flow: "first-run", state: "loading", devices: ["phone"], build: () => base({ cast: "searching" }) },
  { id: "first-run.04-no-tv", label: "No TV found on this Wi-Fi", flow: "first-run", state: "error", devices: ["phone"], build: () => base({ cast: "none-found" }) },
  { id: "first-run.05-connecting", label: "Turning on the living room", flow: "first-run", state: "loading", devices: all(), build: () => base({ cast: "connecting" }) },
  { id: "first-run.06-room-fresh", label: "The room on the TV, nobody has picked yet", flow: "first-run", state: "success", devices: all(), build: () => base({ fresh: true }) },

  // 2. Driving the launcher
  { id: "home.01-room", label: "Spotlight on Rocket Crew", flow: "home", state: "default", devices: ["tv", "phone"], build: () => base() },
  { id: "home.02-focus-bake", label: "Spotlight moved to Bake Shop (remote right)", flow: "home", state: "default", devices: ["tv", "phone"], build: () => base({ focus: "g:bake-shop" }) },
  { id: "home.03-focus-night", label: "Spotlight on game night through the window", flow: "home", state: "default", devices: ["tv", "phone"], build: () => base({ focus: "night" }) },
  { id: "home.04-remote-only", label: "Just the remote: eyes on the TV", flow: "home", state: "default", devices: ["tv", "phone"], build: () => base({ focus: "g:story-nook", layout: "remote" }) },
  {
    id: "home.05-detail-rocket",
    label: "Rocket Crew box opened: resume point, who's playing",
    flow: "home",
    state: "default",
    devices: all(),
    build: () => base({ view: { kind: "detail", gameId: "rocket-crew" }, focus: "continue", roomFocus: "g:rocket-crew", pick: ["dad", "juneau"] }),
  },
  {
    id: "home.06-detail-remote",
    label: "Box opened, driven with just the remote",
    flow: "home",
    state: "default",
    devices: ["phone"],
    build: () => base({ view: { kind: "detail", gameId: "rocket-crew" }, focus: "continue", roomFocus: "g:rocket-crew", pick: ["dad", "juneau"], layout: "remote" }),
  },

  // 3. Who's playing
  {
    id: "tonight.01-who-picker",
    label: "Who's playing: spotlight on Ava, not seated yet",
    flow: "tonight",
    state: "partial",
    devices: all(),
    build: () => base({ view: { kind: "detail", gameId: "peekaboo-garden" }, focus: "p:ava", roomFocus: "g:peekaboo-garden", pick: ["dad", "juneau"] }),
  },
  {
    id: "tonight.02-ava-seated",
    label: "Ava seated: her iPad lights up",
    flow: "tonight",
    state: "success",
    devices: all(),
    build: () => base({ view: { kind: "detail", gameId: "peekaboo-garden" }, focus: "p:ava", roomFocus: "g:peekaboo-garden", pick: ["dad", "juneau", "ava"] }),
  },

  // 4. Launch → play → Home → swap
  { id: "swap.01-playing-rocket", label: "Rocket Crew mission 6: Captain phone, Fixer + helper iPads", flow: "swap", state: "default", devices: all(), build: () => playingRocket() },
  { id: "swap.02-home", label: "Home: Rocket Crew folds back into its box at Mission 6", flow: "swap", state: "success", devices: all(), build: () => pausedRocket() },
  {
    id: "swap.03-bake-open",
    label: "Bake Shop day 4 opened from the phone's room",
    flow: "swap",
    state: "default",
    devices: all(),
    build: () => pausedRocket({ note: undefined, view: { kind: "detail", gameId: "bake-shop" }, focus: "continue", roomFocus: "g:bake-shop", pick: ["dad", "juneau", "ava"] }),
  },
  {
    id: "swap.04-bake-playing",
    label: "Bake Shop day 4 in the same stream, iPads followed",
    flow: "swap",
    state: "success",
    devices: all(),
    build: () => {
      const s = pausedRocket({ note: undefined, view: { kind: "game", gameId: "bake-shop" }, crew: ["dad", "juneau", "ava"] });
      const bs = s.saves["bake-shop"];
      return bs ? { ...s, saves: { ...s.saves, "bake-shop": { ...bs, when: "Playing now" } } } : s;
    },
  },

  // 5. Your turn on the launcher
  { id: "word-duel.01-note", label: "Spotlight on Nana's note: your turn", flow: "word-duel", state: "default", devices: ["tv", "phone"], build: () => base({ focus: "d:wd-1" }) },
  { id: "word-duel.02-on-phone", label: "Note taken down: played on the phone", flow: "word-duel", state: "default", devices: ["tv", "phone"], build: () => base({ view: { kind: "duel", duelId: "wd-1" }, focus: "d:wd-1", roomFocus: "d:wd-1" }) },
  { id: "word-duel.03-tiles", label: "Building TAME down from QUILT", flow: "word-duel", state: "partial", devices: ["phone"], build: () => base({ view: { kind: "duel", duelId: "wd-1" }, focus: "d:wd-1", tiles: [1, 5, 4] }) },
  { id: "word-duel.04-sent", label: "Sent: Nana's note turns to waiting", flow: "word-duel", state: "success", devices: ["tv", "phone"], build: () => base({ duelsDone: ["wd-1"], note: "Word sent. Your move is on its way" }) },

  // Game night
  { id: "game-night.01-window", label: "Game night opened from the window", flow: "game-night", state: "default", devices: ["tv", "phone"], build: () => base({ view: { kind: "night" }, focus: "join", roomFocus: "night" }) },

  // 6. Edge
  { id: "failure.01-remote-asleep", label: "Jonathan's phone sleeps: Mom's phone can pick up the remote", flow: "failure", state: "interrupted", devices: ["tv", "phone"], build: () => base({ asleep: true, phoneOf: "mom", focus: "g:bake-shop" }) },
  { id: "failure.02-remote-picked-up", label: "Mom has the remote", flow: "failure", state: "success", devices: ["tv", "phone"], build: () => base({ holder: "mom", phoneOf: "mom", focus: "g:bake-shop", note: "You have the remote" }) },
  { id: "failure.03-asleep-in-game", label: "Captain's phone sleeps mid-mission", flow: "failure", state: "interrupted", devices: all(), build: () => playingRocket({ asleep: true, phoneOf: "mom" }) },
  { id: "failure.04-cast-dropped", label: "The cast drops mid-mission", flow: "failure", state: "error", devices: all(), build: () => playingRocket({ cast: "dropped", resumeView: { kind: "game", gameId: "rocket-crew" } }) },
  { id: "failure.05-recasting", label: "Re-cast: Rocket Crew comes back at Mission 6", flow: "failure", state: "loading", devices: ["tv", "phone"], build: () => playingRocket({ cast: "connecting", resumeView: { kind: "game", gameId: "rocket-crew" } }) },
];
