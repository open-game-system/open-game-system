import type { Scenario } from "../../harness/types";
import { base, playDuel, type S } from "./state";

const at = (patch: Partial<S>) => (): S => ({ ...base(), ...patch });
const switching = (phase: "saving" | "cutover" | "following", extra: Partial<S> = {}) =>
  at({ phone: "controller", switching: { from: "rocket-crew", to: "bake-shop", phase, undo: false }, ...extra });
const bakeLive: Partial<S> = { phone: "controller", onTv: "bake-shop", tvFocus: "bake-shop", left: { gameId: "rocket-crew", undone: false }, savedTonight: { "rocket-crew": "7:14 pm" } };

export const scenarios: Scenario<S>[] = [
  // Home: Friday 7:10 pm
  { id: "home.01-phone-friday", label: "Phone home: now playing, your turn, jump back in", flow: "home", state: "default", devices: ["phone"], build: at({}) },
  { id: "home.02-tv-console-home", label: "TV console home (cast, between games)", flow: "home", state: "default", devices: ["tv", "phone"], build: at({ onTv: null, tvFocus: "rocket-crew" }) },
  { id: "home.06-phone-is-remote", label: "Phone is the remote: focus Bake Shop, the TV follows", flow: "home", state: "partial", devices: ["phone", "tv"], build: at({ onTv: null, tvFocus: "bake-shop" }) },
  { id: "home.03-kid-paired-idle", label: "Juneau's iPad: paired, following tonight", flow: "home", state: "default", devices: ["ipad"], build: at({ onTv: null }) },
  { id: "home.04-library", label: "Library: couch shelf, game night, duels", flow: "home", state: "default", devices: ["phone"], build: at({ tab: "library" }) },
  { id: "home.05-first-run", label: "First run: library ready, living room not set up", flow: "home", state: "empty", devices: ["phone"], build: at({ firstRun: true, onTv: null }) },

  // Swap: Rocket Crew mission 6 → Bake Shop day 4, all devices
  { id: "swap.01-mid-rocket-crew", label: "Mid Rocket Crew: Dad captains, Juneau fixes", flow: "swap", state: "default", devices: ["phone", "ipad", "tv"], build: at({ phone: "controller" }) },
  { id: "swap.02-console-menu", label: "Console button: pick the next game", flow: "swap", state: "default", devices: ["phone", "tv"], build: at({ phone: "controller", menu: true }) },
  { id: "swap.03-saving", label: "Saving Rocket Crew at mission 6", flow: "swap", state: "loading", devices: ["phone", "tv", "ipad"], build: switching("saving") },
  { id: "swap.04-tv-cutover", label: "TV cuts over to Bake Shop", flow: "swap", state: "loading", devices: ["tv", "phone", "ipad"], build: switching("cutover") },
  { id: "swap.05-kids-follow", label: "Kid iPads follow by name", flow: "swap", state: "partial", devices: ["ipad", "tv", "phone"], build: switching("following") },
  { id: "swap.06-everyone-in", label: "Bake Shop day 4, everyone in their seat", flow: "swap", state: "success", devices: ["phone", "tv", "ipad"], build: at(bakeLive) },
  { id: "swap.07-ava-helper", label: "Ava's iPad: littlest helper", flow: "swap", state: "success", devices: ["ipad"], build: at({ ...bakeLive, ipad: "ava" }) },
  { id: "swap.08-ava-asleep-switching", label: "Ava's iPad asleep (9%) while everyone moves", flow: "swap", state: "interrupted", devices: ["tv", "phone"], build: switching("following", { asleep: ["dev-ava-ipad"] }) },
  { id: "swap.09-ava-asleep", label: "Ava's iPad didn't follow: seat saved", flow: "swap", state: "interrupted", devices: ["phone", "ipad"], build: at({ ...bakeLive, ipad: "ava", asleep: ["dev-ava-ipad"] }) },
  { id: "swap.10-ava-wakes", label: "Ava's iPad wakes and drops into her seat", flow: "swap", state: "success", devices: ["phone", "ipad"], build: at({ ...bakeLive, ipad: "ava", lateJoin: "dev-ava-ipad" }) },
  { id: "swap.11-undo-back", label: "Undo: back to Rocket Crew mission 6", flow: "swap", state: "undone", devices: ["phone", "tv", "ipad"], build: at({ phone: "controller", onTv: "rocket-crew", left: { gameId: "bake-shop", undone: true }, savedTonight: { "rocket-crew": "7:14 pm", "bake-shop": "7:16 pm" } }) },

  // Word Duel
  { id: "word-duel.01-list", label: "Word Duel: open games by whose turn", flow: "word-duel", state: "default", devices: ["phone"], build: at({ phone: "duels" }) },
  { id: "word-duel.02-nana-board", label: "Nana's game: board and rack", flow: "word-duel", state: "default", devices: ["phone"], build: at({ phone: "duel", duel: { open: "wd-1", placed: [], result: null } }) },
  { id: "word-duel.03-placing", label: "Placing tiles", flow: "word-duel", state: "partial", devices: ["phone"], build: at({ phone: "duel", duel: { open: "wd-1", placed: ["C", "R"], result: null } }) },
  { id: "word-duel.04-ready", label: "CRANE ready to play", flow: "word-duel", state: "partial", devices: ["phone"], build: at({ phone: "duel", duel: { open: "wd-1", placed: ["C", "R", "A", "N"], result: null } }) },
  { id: "word-duel.05-played", label: "Played: next game waiting on you", flow: "word-duel", state: "success", devices: ["phone"], build: () => playedState() },
  { id: "word-duel.06-list-after", label: "List after: Nana's game moved to their turn", flow: "word-duel", state: "success", devices: ["phone"], build: () => ({ ...playedState(), phone: "duels", duel: { open: null, placed: [], result: null } }) },
  { id: "word-duel.07-not-a-word", label: "Not a word: nothing played", flow: "word-duel", state: "error", devices: ["phone"], build: at({ phone: "duel", duel: { open: "wd-1", placed: ["D", "R", "A", "N"], result: "invalid" } }) },
  { id: "word-duel.08-empty", label: "No duels yet", flow: "word-duel", state: "empty", devices: ["phone"], build: at({ phone: "duels", duels: [] }) },
];

function playedState(): S {
  return playDuel({ ...base(), phone: "duel", duel: { open: "wd-1", placed: ["C", "R", "A", "N"], result: null } });
}
