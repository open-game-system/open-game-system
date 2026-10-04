// The lobby table: every state of a game night is one round table seen from above, a seat per home.
// This file derives what the table shows (pure): the night's phase, each seat's light (here · on
// the way · away), its screen, its lock (what other homes see), and whose roll it is.
import { HOUSEHOLDS, type Household } from "../../../../world";
import { household, short, US, type Night, type NightHome, type Nights } from "../../nights";

/** One state of the night, as the table shows it. */
export type Phase = "inviting" | "filling" | "declined" | "ready" | "live" | "paused" | "dropped" | "holding" | "finished";

/** here: at the table now · coming: invited, or reconnecting · away: not here · empty: a free chair. */
export type Light = "here" | "coming" | "away" | "empty";

/** A home that dropped mid-night, as the host's phone sees it. */
export interface Drop {
  householdId: string;
  /** "now": the host decides · "holding": the board waits for them. */
  phase: "now" | "holding";
}

export interface SeatView {
  /** Unique at the table (our split seat adds "juneau"). */
  key: string;
  householdId: string;
  /** "Mumms", "Okafors"… (the kid's own seat shows his name: our phone sees our own people). */
  name: string;
  color: string;
  colorName: string;
  crest: Household;
  /** The kid sitting on his own (split seat), shown as his sticker on our phone only. */
  kid: boolean;
  light: Light;
  /** The light in words: "Here", "Invited", "Offline", "Can't make it"… */
  word: string;
  screen: "tv" | "phones";
  screenWord: string;
  turn: boolean;
  host: boolean;
  score: number | null;
  /** In the inviting phase: will this home get an invite. */
  picked: boolean;
}

export function phaseOf(n: Night | undefined, drop: Drop | null): Phase {
  if (!n || n.status === "lobby") return n ? "ready" : "inviting";
  if (drop) return drop.phase === "now" ? "dropped" : "holding";
  if (n.status === "finished") return "finished";
  if (n.status === "live") return "live";
  if (n.status === "paused") return "paused";
  if (n.homes.some((h) => h.reply === "declined")) return "declined";
  if (n.homes.some((h) => h.reply === "invited")) return "filling";
  return "ready";
}

const COLOR_NAME: Record<string, string> = { "#2f6fc8": "blue", "#c8412f": "red", "#e08a1e": "amber", "#1f8a5b": "green" };
const SEAT_COLOR: Record<string, string> = { "hh-okafor": "#c8412f", "hh-nana": "#e08a1e" };

function screenOf(h: NightHome, viewer: string): string {
  if (h.screen === "phones") return "Phones";
  if (h.householdId !== viewer) return "Their TV";
  return h.householdId === US ? "Living room TV" : "Your TV";
}

function lightOf(h: NightHome, phase: Phase, drop: Drop | null): { light: Light; word: string } {
  if (drop && drop.householdId === h.householdId) return drop.phase === "now" ? { light: "away", word: "Offline" } : { light: "coming", word: "Reconnecting" };
  if (h.reply === "invited") return { light: "coming", word: "Invited" };
  if (h.reply === "declined") return { light: "away", word: "Can't make it" };
  if (!h.back) return phase === "live" ? { light: "away", word: "Skipped" } : { light: "away", word: "Not back yet" };
  if (phase === "finished") return { light: "here", word: "Played" };
  return { light: "here", word: h.householdId === US ? "Hosting" : "Here" };
}

/** The seats in turn order, with the viewer's home first (it sits nearest, at the bottom). */
export function seatsOf(ns: Nights, n: Night | undefined, drop: Drop | null, viewer: string = US): SeatView[] {
  const phase = phaseOf(n, drop);
  if (!n) return inviteSeats(ns);
  const showTurn = phase === "live" || phase === "paused" || phase === "dropped" || phase === "holding";
  const scored = showTurn || phase === "finished";
  const seats: SeatView[] = [];
  for (const h of n.homes) {
    const { light, word } = lightOf(h, phase, drop);
    const base: SeatView = {
      key: h.householdId,
      householdId: h.householdId,
      name: short(h.name),
      color: h.color,
      colorName: h.colorName,
      crest: household(h.householdId),
      kid: false,
      light,
      word,
      screen: h.screen,
      screenWord: screenOf(h, viewer),
      turn: showTurn && n.turnOf === h.householdId,
      host: h.householdId === US,
      score: scored ? h.score : null,
      picked: true,
    };
    if (h.householdId === US && h.seat === "split") {
      seats.push({ ...base, name: "Jonathan" });
      seats.push({ ...base, key: "juneau", name: viewer === US ? "Juneau" : "Mumms", color: "#1f8a5b", colorName: "green", kid: viewer === US, word: light === "here" ? "Here" : word, turn: false, host: false, score: scored ? 0 : null });
    } else seats.push(base);
  }
  const i = Math.max(0, seats.findIndex((x) => x.householdId === viewer));
  return [...seats.slice(i), ...seats.slice(0, i)];
}

/** Before any invite goes out: our seat, and a chair for every home we play with (ticked = invite). */
function inviteSeats(ns: Nights): SeatView[] {
  return HOUSEHOLDS.map((hh): SeatView => {
    const us = hh.id === US;
    const picked = us || ns.picked.includes(hh.id);
    const color = us ? "#2f6fc8" : (SEAT_COLOR[hh.id] ?? "#1f8a5b");
    const tv = hh.devices.some((d) => d.kind === "tv" && d.online);
    return {
      key: hh.id,
      householdId: hh.id,
      name: short(hh.name),
      color,
      colorName: COLOR_NAME[color] ?? "",
      crest: hh,
      kid: false,
      light: us ? "here" : picked ? "coming" : "empty",
      word: us ? "Hosting" : picked ? "Will invite" : "Tap to invite",
      screen: tv ? "tv" : "phones",
      screenWord: us ? "Living room TV" : tv ? "Their TV" : "Phones",
      turn: false,
      host: us,
      score: null,
      picked,
    };
  });
}

/** Where a seat sits around the table: an angle in degrees (0 = right, 90 = bottom, clockwise). */
export function seatAngles(count: number): number[] {
  if (count === 4) return [45, 135, 225, 315];
  if (count === 2) return [90, 270];
  return Array.from({ length: count }, (_, i) => 90 + (i * 360) / count);
}
