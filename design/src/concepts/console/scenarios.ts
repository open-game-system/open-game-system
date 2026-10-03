import type { Scenario } from "../../harness/types";
import { answerInvites, baseNights, beginNewNight, homesReturn, openNight, passTurn, pauseNight, resumeNight, sendInvites, startNight, toStep, toggleSplit, type Nights } from "./nights";
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
  { id: "home.07-our-roll", label: "Our roll in Hearthisle: it joins Your turn beside the duels", flow: "home", state: "partial", devices: ["phone"], build: at({ nights: nightsWith((n) => passTurn(resumeNight(n, "hi-1"), "hi-1")), onTv: null }) },
  { id: "home.08-all-caught-up", label: "Nobody waiting on you; nights still listed", flow: "home", state: "empty", devices: ["phone"], build: at({ duels: [] }) },
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

  // Game night across three homes (flow 5), phone side
  { id: "game-night.01-lane", label: "Home: Game nights lane, Hearthisle paused at turn 14", flow: "game-night", state: "default", devices: ["phone"], build: at({ onTv: null }) },
  { id: "game-night.02-paused-night", label: "Hearthisle night: paused at turn 14, tonight 8:00, Nana & Pop not back", flow: "game-night", state: "default", devices: ["phone"], build: nightAt((n) => openNight(n, "hi-1")) },
  { id: "game-night.03-new-while-paused", label: "New game night: pick homes; turn 14 keeps its place", flow: "game-night", state: "default", devices: ["phone"], build: nightAt(beginNewNight) },
  { id: "game-night.04-kid-names-on", label: "Trust: show Juneau's name to the other homes (off by default)", flow: "game-night", state: "partial", devices: ["phone"], build: () => ({ ...nightAt(beginNewNight)(), nights: { ...beginNewNight(baseNights()), kidNames: true } }) },
  { id: "game-night.05-invites-out", label: "Invites sent: Okafors and Nana & Pop deciding", flow: "game-night", state: "loading", devices: ["phone"], build: nightAt((n) => sendInvites(beginNewNight(n))) },
  { id: "game-night.06-what-they-see", label: "What Nana & Pop see: the invite, accept or decline", flow: "game-night", state: "default", devices: ["phone"], build: nightAt((n) => ({ ...sendInvites(beginNewNight(n)), preview: true })) },
  { id: "game-night.07-everyone-in", label: "Both homes said yes", flow: "game-night", state: "success", devices: ["phone"], build: nightAt((n) => answerInvites(sendInvites(beginNewNight(n)))) },
  { id: "game-night.08-seats", label: "Seats: Jonathan + Juneau share blue; a seat is a person or a home", flow: "game-night", state: "default", devices: ["phone"], build: nightAt((n) => toStep(answerInvites(sendInvites(beginNewNight(n))), "seats")) },
  { id: "game-night.09-seats-split", label: "Seats: Juneau gets his own (green)", flow: "game-night", state: "partial", devices: ["phone"], build: nightAt((n) => toggleSplit(toStep(answerInvites(sendInvites(beginNewNight(n))), "seats"))) },
  { id: "game-night.10-where", label: "Where each home plays: our TV, their TV, Nana & Pop on phones", flow: "game-night", state: "default", devices: ["phone"], build: nightAt((n) => toStep(answerInvites(sendInvites(beginNewNight(n))), "where")) },
  { id: "game-night.11-started", label: "Started: turn 1, Okafors rolling, ours next", flow: "game-night", state: "success", devices: ["phone", "tv"], build: () => ({ ...nightAt((n) => ({ ...startNight(answerInvites(sendInvites(beginNewNight(n)))), step: "detail" }))(), onTv: "hearthisle", tvFocus: "hearthisle" }) },
  { id: "game-night.12-two-nights", label: "Home: two game nights, one paused, one live", flow: "game-night", state: "partial", devices: ["phone"], build: () => ({ ...at({ onTv: "hearthisle", tvFocus: "hearthisle" })(), nights: { ...startNight(answerInvites(sendInvites(beginNewNight(baseNights())))), open: null, step: "detail" } }) },
  { id: "game-night.13-declined", label: "Nana & Pop declined: their seat leaves, the night still works", flow: "game-night", state: "error", devices: ["phone"], build: nightAt((n) => declineNana(sendInvites(beginNewNight(n)))) },
  { id: "game-night.14-everyone-back", label: "Friday 8:00: every home is back, resume turn 14", flow: "game-night", state: "default", devices: ["phone"], build: nightAt((n) => openNight(homesReturn(n, "hi-1"), "hi-1"), { onTv: null }) },
  { id: "game-night.15-resumed", label: "Resumed: turn 14, Nana & Pop rolling, ours next", flow: "game-night", state: "success", devices: ["phone", "tv"], build: nightAt((n) => openNight(resumeNight(n, "hi-1"), "hi-1"), { onTv: "hearthisle", tvFocus: "hearthisle" }) },
  { id: "game-night.16-our-roll", label: "Our roll across homes: Controller or pause", flow: "game-night", state: "partial", devices: ["phone", "tv"], build: nightAt((n) => openNight(passTurn(resumeNight(n, "hi-1"), "hi-1"), "hi-1"), { onTv: "hearthisle", tvFocus: "hearthisle" }) },
  { id: "game-night.17-paused-again", label: "Paused at turn 15: resumes when everyone's back, next Friday", flow: "game-night", state: "interrupted", devices: ["phone"], build: nightAt((n) => openNight(pauseNight(passTurn(resumeNight(n, "hi-1"), "hi-1"), "hi-1"), "hi-1"), { onTv: null }) },
];

/** The phone on a game night's page, with the nights in a given state. */
function nightAt(f: (n: Nights) => Nights, extra: Partial<S> = {}) {
  return (): S => ({ ...base(), onTv: null, ...extra, phone: "night", nights: f(baseNights()) });
}

function nightsWith(f: (n: Nights) => Nights): Nights {
  return { ...f(baseNights()), open: null };
}

function declineNana(n: Nights): Nights {
  return { ...n, list: n.list.map((x) => (x.id === n.open ? { ...x, homes: x.homes.map((h) => (h.householdId === "hh-nana" ? { ...h, reply: "declined" } : h.reply === "invited" ? { ...h, reply: "in" } : h)) } : x)) };
}

function playedState(): S {
  return playDuel({ ...base(), phone: "duel", duel: { open: "wd-1", placed: ["C", "R", "A", "N"], result: null } });
}
