// Session state for the "Living Room Console" concept. One store, shared by every device.
// The console owns: who is here tonight, what is on the TV, the switch between games, and saves.
// Games own: everything inside their own view (controllers, TV scene).
import { COUCH, DUELS, HOME, gameById, type DuelGame, type GameManifest, type OwnedDevice, type Person, type Role } from "../../world";

export type PhoneView = "home" | "controller" | "duels" | "duel";
export type SwitchPhase = "saving" | "cutover" | "following";

export interface Switching {
  from: string;
  to: string;
  phase: SwitchPhase;
  /** True when this switch is the "back to …" undo of the previous one. */
  undo: boolean;
}

export interface DuelView {
  open: string | null;
  /** Rack letters placed on the board, in order. */
  placed: string[];
  result: "played" | "invalid" | null;
}

export interface S {
  firstRun: boolean;
  phone: PhoneView;
  tab: "home" | "library";
  /** The game running on the TV; null = the console home is on the TV. */
  onTv: string | null;
  /** The activity the TV home is showing large (follows the phone). */
  tvFocus: string;
  menu: boolean;
  switching: Switching | null;
  /** The game this sitting just left (offered as "back to …"), and whether that undo already ran. */
  left: { gameId: string; undone: boolean } | null;
  /** Which kid's iPad the iPad surface is. */
  ipad: "juneau" | "ava";
  /** Paired devices that are asleep (screen off / low battery) and so haven't followed yet. */
  asleep: string[];
  /** A device that woke after the switch and dropped straight into its seat. */
  lateJoin: string | null;
  rung: boolean;
  /** Resume points the console saved tonight, by game id ("7:14 pm"). */
  savedTonight: Record<string, string>;
  duels: DuelGame[];
  duel: DuelView;
}

export const PRESENT: Person[] = HOME.people.filter((p) => p.id !== "mom");

export function base(): S {
  return {
    firstRun: false,
    phone: "home",
    tab: "home",
    onTv: "rocket-crew",
    tvFocus: "rocket-crew",
    menu: false,
    switching: null,
    left: null,
    ipad: "juneau",
    asleep: [],
    lateJoin: null,
    rung: false,
    savedTonight: {},
    duels: DUELS.map((d) => ({ ...d })),
    duel: { open: null, placed: [], result: null },
  };
}

/** Resume point a game last reported (Tier 1/2), short form: "Mission 6", "Day 4". */
export function resumePoint(gameId: string): string {
  const inst = COUCH.find((i) => i.gameId === gameId);
  if (!inst) return "Start fresh";
  return inst.title.split(" · ")[0] ?? inst.title;
}

export function resumeDetail(gameId: string): string {
  const inst = COUCH.find((i) => i.gameId === gameId);
  if (!inst) return "";
  const rest = inst.title.split(" · ").slice(1).join(" · ");
  return rest;
}

export interface SeatAssign {
  person: Person;
  role: Role;
  device: OwnedDevice | undefined;
}

/** Who sits where, from the household's age bands and the manifest's roles. No per-game code. */
export function seatPlan(game: GameManifest, present: Person[] = PRESENT): SeatAssign[] {
  const out: SeatAssign[] = [];
  for (const person of present) {
    const role =
      game.roles.find((r) => r.audience === person.band) ??
      (person.band === "little" ? game.roles.find((r) => r.audience === "kid") : undefined) ??
      game.roles[0];
    if (!role) continue;
    const device = HOME.devices.find((d) => d.personId === person.id && (d.kind === "phone" || d.kind === "ipad"));
    out.push({ person, role, device });
  }
  return out;
}

// ---- actions (pure) ----

export const openMenu = (s: S): S => ({ ...s, menu: true });
export const closeMenu = (s: S): S => ({ ...s, menu: false });

export function startSwitch(s: S, to: string): S {
  const from = s.onTv;
  if (!from || from === to) return { ...s, menu: false, onTv: to, phone: "controller" };
  return { ...s, menu: false, phone: "controller", switching: { from, to, phase: "saving", undo: false }, lateJoin: null, rung: false };
}

export function undoSwitch(s: S): S {
  if (!s.left || !s.onTv || s.left.undone) return s;
  return { ...s, switching: { from: s.onTv, to: s.left.gameId, phase: "saving", undo: true } };
}

export function advance(s: S): S {
  const sw = s.switching;
  if (!sw) return s;
  if (sw.phase === "saving") return { ...s, switching: { ...sw, phase: "cutover" } };
  if (sw.phase === "cutover") return { ...s, switching: { ...sw, phase: "following" } };
  return {
    ...s,
    switching: null,
    onTv: sw.to,
    tvFocus: sw.to,
    left: { gameId: sw.from, undone: sw.undo },
    savedTonight: { ...s.savedTonight, [sw.from]: sw.undo ? "7:16 pm" : "7:14 pm" },
  };
}

export const gameName = (id: string): string => gameById(id).name;

// ---- Word Duel (design-only async game) ----

export const RACK = ["C", "R", "A", "N", "S", "D", "O"];
export const TARGET = ["C", "R", "A", "N"];

export function playDuel(s: S): S {
  const open = s.duel.open;
  if (!open) return s;
  const word = [...s.duel.placed, "E"].join("");
  if (word !== "CRANE") return { ...s, duel: { ...s.duel, result: "invalid" } };
  const duels = s.duels.map((d): DuelGame => {
    if (d.id !== open) return d;
    const moved: DuelGame = { ...d, status: "waiting", you: d.you + 27, lastMove: "You played CRANE for 27", lastWord: "CRANE", updatedAt: "2026-10-03T19:11:00-07:00" };
    return moved;
  });
  return { ...s, duels, duel: { ...s.duel, result: "played" } };
}

/** One line for "what you'd get if you started this now". */
export function nextLine(gameId: string): string {
  const inst = COUCH.find((i) => i.gameId === gameId);
  if (!inst) return gameById(gameId).tagline;
  if (inst.status === "suspended" || inst.status === "active") return `Resume at ${resumePoint(gameId).toLowerCase()}`;
  return inst.title;
}
