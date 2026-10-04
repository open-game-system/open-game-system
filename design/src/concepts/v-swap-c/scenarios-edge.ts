import type { Scenario } from "../../harness/types";
import { fault, type Fault } from "./edge/fault";
import { foundTv } from "./edge/phone";
import { resumeNight, type Nights } from "./nights";
import { base, type S } from "./state";

const at = (patch: Partial<S>, f: Fault | null) => (): S => ({ ...base(), phone: "controller", ...patch, fault: f });

const bakeLive: Partial<S> = { phone: "controller", onTv: "bake-shop", tvFocus: "bake-shop", left: null, savedTonight: { "rocket-crew": "7:14 pm" } };

/** Hearthisle live across three homes, turn 15, the Okafors' roll; `okaforsBack` = their phone is online. */
function nightAt15(okaforsBack: boolean, phone: S["phone"] = "night"): Partial<S> {
  const n0: Nights = resumeNight(base().nights, "hi-1");
  const nights: Nights = {
    ...n0,
    open: "hi-1",
    step: "detail",
    list: n0.list.map((n) =>
      n.id === "hi-1" ? { ...n, turn: 15, turnOf: "hh-okafor", homes: n.homes.map((h) => (h.householdId === "hh-okafor" ? { ...h, back: okaforsBack } : h)) } : n,
    ),
  };
  return { phone, onTv: "hearthisle", tvFocus: "hearthisle", nights };
}

const consoleBake: Partial<S> = { phone: "home", onTv: null, tvFocus: "bake-shop" };
const tonightOff: Partial<S> = { phone: "home", onTv: null, tvFocus: "rocket-crew", cast: "off" };
const J = "dev-juneau-ipad";

/** Scenarios owned by the edge owner (flow "failure"). Every fault, on every device it touches. */
export const edgeScenarios: Scenario<S>[] = [
  // 1. Cast lost: the Chromecast drops mid-mission.
  { id: "failure.00-mid-mission", label: "Mid mission 6, a moment before the TV picture freezes", flow: "failure", state: "default", devices: ["tv"], build: at({}, fault("stream-stall", "armed")) },
  { id: "failure.01-cast-lost", label: "Cast lost: Rocket Crew paused itself at mission 6", flow: "failure", state: "error", devices: ["phone", "tv", "ipad"], build: at({}, fault("cast-lost", "now")) },
  { id: "failure.01a-cast-lost-ava", label: "Cast lost: Ava's dinosaur waits with her", flow: "failure", state: "error", devices: ["ipad"], build: at({ ipad: "ava" }, fault("cast-lost", "now")) },
  { id: "failure.02-cast-again", label: "Casting again: a fresh TV picture at mission 6", flow: "failure", state: "loading", devices: ["phone", "tv", "ipad"], build: at({}, fault("cast-lost", "recovering")) },
  { id: "failure.03-cast-back", label: "Back on the TV at mission 6, kids dropped back in", flow: "failure", state: "success", devices: ["phone", "tv", "ipad"], build: at({}, fault("cast-lost", "recovered")) },

  // 2. Stream stalls / the cloud renderer crashes.
  { id: "failure.04-picture-froze", label: "Picture froze: restarting at mission 6", flow: "failure", state: "error", devices: ["phone", "tv", "ipad"], build: at({}, fault("stream-stall", "now")) },
  { id: "failure.05-fresh-picture", label: "A fresh cloud picture comes up at mission 6", flow: "failure", state: "loading", devices: ["phone", "tv", "ipad"], build: at({ ipad: "ava" }, fault("stream-stall", "recovering")) },
  { id: "failure.06-picture-back", label: "Picture back at mission 6: nothing lost", flow: "failure", state: "success", devices: ["phone", "tv", "ipad"], build: at({ ipad: "ava" }, fault("stream-stall", "recovered")) },

  // 3. The remote phone dies; Mom's phone picks up the remote.
  { id: "failure.09-remote-armed", label: "Jonathan's phone at 1%, a moment before it goes dark", flow: "failure", state: "default", devices: ["phone"], build: at({}, fault("remote-dies", "armed", { viewer: "mom", subject: "dev-dad-phone" })) },
  { id: "failure.10-remote-dark", label: "Jonathan's phone went dark: a push on Mom's phone; the game keeps going", flow: "failure", state: "interrupted", devices: ["phone", "tv", "ipad"], build: at({}, fault("remote-dies", "now", { viewer: "mom", subject: "dev-dad-phone" })) },
  { id: "failure.11-remote-offer", label: "Mom's phone: pick up the remote, nothing restarts", flow: "failure", state: "partial", devices: ["phone"], build: at({}, fault("remote-dies", "recovering", { viewer: "mom", subject: "dev-dad-phone" })) },
  { id: "failure.12-remote-mom", label: "Mom's phone is the remote, still mission 6", flow: "failure", state: "success", devices: ["phone", "tv"], build: at({}, fault("remote-dies", "recovered", { viewer: "mom", subject: "dev-dad-phone" })) },

  // 4. A kid iPad goes offline mid-game.
  { id: "failure.20-juneau-offline", label: "Juneau's iPad lost Wi-Fi: seat kept, he waits with his dragon", flow: "failure", state: "interrupted", devices: ["ipad", "phone", "tv"], build: at({}, fault("ipad-offline", "now", { subject: J })) },
  { id: "failure.21-juneau-rejoining", label: "Back on Wi-Fi: rejoining his seat by itself", flow: "failure", state: "loading", devices: ["ipad", "phone"], build: at({}, fault("ipad-offline", "recovering", { subject: J })) },
  { id: "failure.22-juneau-back", label: "Juneau dropped back into his seat", flow: "failure", state: "success", devices: ["ipad", "phone", "tv"], build: at({}, fault("ipad-offline", "recovered", { subject: J })) },

  // 5. Save conflict (409): two phones saved Bake Shop day 4 differently.
  { id: "failure.30-save-conflict", label: "Two day 4s: the living room's or Mom's, with what each holds", flow: "failure", state: "error", devices: ["phone", "tv"], build: at(bakeLive, fault("save-conflict", "now", { save: "tonight" })) },
  { id: "failure.31-save-pick-moms", label: "Picking Mom's day 4 instead", flow: "failure", state: "partial", devices: ["phone"], build: at(bakeLive, fault("save-conflict", "now", { save: "tuesday" })) },
  { id: "failure.32-save-kept", label: "The living room's day 4 kept; Mom's kept in Saves", flow: "failure", state: "success", devices: ["phone"], build: at(bakeLive, fault("save-conflict", "recovered", { save: "tonight" })) },
  { id: "failure.33-save-swapped", label: "Changed our minds: Mom's day 4, the living room's kept", flow: "failure", state: "undone", devices: ["phone"], build: at(bakeLive, fault("save-conflict", "undone", { save: "tuesday" })) },

  // 6. A home drops mid game night.
  { id: "failure.40-okafors-drop", label: "The Okafors dropped at turn 15: the host decides", flow: "failure", state: "error", devices: ["phone", "tv"], build: at(nightAt15(false, "home"), fault("home-drops", "now", { subject: "hh-okafor" })) },
  { id: "failure.41-holding-board", label: "Holding the board: every home sees it waiting", flow: "failure", state: "loading", devices: ["phone", "tv"], build: at(nightAt15(false, "home"), fault("home-drops", "recovering", { subject: "hh-okafor", night: "wait" })) },
  { id: "failure.42-okafors-back", label: "The Okafors are back: their roll, nobody lost a move", flow: "failure", state: "success", devices: ["phone", "tv"], build: at(nightAt15(true), fault("home-drops", "recovered", { subject: "hh-okafor", night: "wait" })) },
  { id: "failure.43-play-on", label: "Played on without them: their seat keeps its score", flow: "failure", state: "partial", devices: ["phone", "tv"], build: at(nightAt15(false), fault("home-drops", "recovered", { subject: "hh-okafor", night: "play-on" })) },
  { id: "failure.44-nana-sees", label: "Nana's phone: waiting on the Okafors, nothing to do", flow: "failure", state: "partial", devices: ["phone"], build: at(nightAt15(false), fault("home-drops", "recovering", { subject: "hh-okafor", viewer: "nana" })) },
  { id: "failure.45-okafor-offline", label: "Tunde's phone: offline, seat held at turn 15", flow: "failure", state: "error", devices: ["phone"], build: at(nightAt15(false), fault("home-drops", "now", { subject: "hh-okafor", viewer: "tunde" })) },
  { id: "failure.46-okafor-back", label: "Tunde's phone: back, your roll", flow: "failure", state: "success", devices: ["phone"], build: at(nightAt15(true), fault("home-drops", "recovered", { subject: "hh-okafor", viewer: "tunde" })) },

  // 7. Invite expired.
  { id: "failure.50-invite-expired", label: "Nana taps a 3-day-old game-night link", flow: "failure", state: "error", devices: ["phone"], build: at({}, fault("invite-expired", "now", { viewer: "nana" })) },
  { id: "failure.51-nana-asked", label: "Nana asked for a new link", flow: "failure", state: "success", devices: ["phone"], build: at({}, fault("invite-expired", "recovered", { viewer: "nana" })) },
  { id: "failure.52-dad-resend", label: "Jonathan's lock screen: one tap sends Nana a fresh link", flow: "failure", state: "partial", devices: ["phone"], build: at({}, fault("invite-expired", "now", { viewer: "dad" })) },

  // 8. Game server down.
  { id: "failure.60-bake-shop-down", label: "Bake Shop isn't answering: the TV stays on the console", flow: "failure", state: "error", devices: ["phone", "tv"], build: at(consoleBake, fault("game-down", "now", { subject: "bake-shop" })) },
  { id: "failure.61-rocket-instead", label: "Rocket Crew at mission 6 instead; Bake Shop's day 4 safe", flow: "failure", state: "success", devices: ["phone", "tv"], build: at({ onTv: "rocket-crew", tvFocus: "rocket-crew" }, fault("game-down", "recovered", { subject: "bake-shop" })) },

  // 9. No TV found when starting tonight.
  { id: "failure.70-no-tv", label: "Can't find the living room TV", flow: "failure", state: "error", devices: ["phone", "tv"], build: at(tonightOff, fault("no-tv", "now")) },
  { id: "failure.71-looking", label: "Looking again after turning it on", flow: "failure", state: "loading", devices: ["phone"], build: at(tonightOff, fault("no-tv", "recovering")) },
  { id: "failure.72-tv-found", label: "Found it: tonight starts as if it had been there", flow: "failure", state: "success", devices: ["phone", "tv"], build: () => ({ ...foundTv({ ...base(), ...tonightOff }), fault: fault("no-tv", "recovered") }) },
];
