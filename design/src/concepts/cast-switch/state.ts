// "Switch home": cast first, then the TV is a console home that hosts every game in one stream.
// One session state shared by the TV, the grown-up phone and both kid iPads.
import { COUCH, DUELS, GAMES, HEARTHISLE, HOME, NOW, type GameManifest, type Instance, type Person } from "../../world";

export type Zone = "users" | "games" | "system";
export type SystemItem = "turns" | "night" | "family" | "devices" | "stop";
export const SYSTEM: SystemItem[] = ["turns", "night", "family", "devices", "stop"];

export type View =
  | { kind: "home" }
  | { kind: "detail"; gameId: string; focus: number }
  | { kind: "who"; gameId: string | null; mode: "continue" | "new"; focus: number }
  | { kind: "turns"; focus: number }
  | { kind: "devices" }
  | { kind: "game"; gameId: string; phase: "starting" | "playing" };

export type Cast = "off" | "picking" | "none-found" | "connecting" | "on" | "dropped" | "recasting";
export type Btn = "up" | "down" | "left" | "right" | "a" | "b" | "home";

export interface S {
  cast: Cast;
  view: View;
  focus: { zone: Zone; games: number; system: number; users: number };
  /** The TV's game row, most recently played first. */
  order: string[];
  phoneMode: "remote" | "browse";
  coach: boolean;
  /** Who is playing tonight (the couch session); carried into every game. */
  tonight: string[];
  /** Working selection on the "who's playing" screen. */
  picking: string[];
  /** The game paused behind the launcher (Home was pressed in it). */
  suspended: string | null;
  /** A game saved when another was started over it (shown once on the cutover). */
  savedNote: string | null;
  /** A Word Duel game being played on the phone. */
  duel: string | null;
  duelsDone: string[];
  remoteHolder: "dad" | "mom";
  /** Whose phone the phone surface shows. */
  viewer: "dad" | "mom";
  dadAsleep: boolean;
  /** Last remote press, so the phone can echo it. */
  lastPress: Btn | null;
  /** The iPad a single-device shot shows when the harness gives no seat. */
  kidSeat: string;
}

export const COUCH_GAMES = GAMES;
export const game = (id: string): GameManifest => {
  const g = GAMES.find((x) => x.id === id);
  if (!g) throw new Error(`unknown game ${id}`);
  return g;
};
export const PEOPLE: Person[] = HOME.people;
export const personOf = (id: string): Person => {
  const p = PEOPLE.find((x) => x.id === id);
  if (!p) throw new Error(`unknown person ${id}`);
  return p;
};

export const instanceOf = (gameId: string): Instance | undefined =>
  COUCH.find((i) => i.gameId === gameId) ?? (HEARTHISLE.gameId === gameId ? HEARTHISLE : undefined);

export const yourTurnDuels = (done: string[]) => DUELS.filter((d) => d.status === "yourTurn" && !done.includes(d.id));

function when(iso: string): string {
  const d = new Date(iso);
  const t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).toLowerCase();
  const opts = { timeZone: "America/Los_Angeles" };
  const day = d.toLocaleDateString("en-US", { weekday: "long", ...opts });
  const sameDay = d.toLocaleDateString("en-US", opts) === NOW.toLocaleDateString("en-US", opts);
  const days = (NOW.getTime() - d.getTime()) / 86400000;
  return sameDay ? `Tonight ${t}` : days < 6 ? day : `Last ${day}`;
}

export interface Resume {
  lead: string;
  title: string;
  detail: string;
  players: string[];
  when: string;
}

/** What a game's tile says under it: its resume point, written by the game (Tier 1/2) or nothing (Tier 0). */
export function resumeOf(gameId: string, s: S): Resume | null {
  const g = game(gameId);
  if (g.shape === "async") {
    const n = yourTurnDuels(s.duelsDone).length;
    return { lead: n ? "Your turn" : "Waiting on them", title: n ? `${n} games are your move` : "Every game is their move", detail: "Played on your phone, never on the TV", players: [], when: "Nana played QUILT at 6:47 pm" };
  }
  const inst = instanceOf(gameId);
  if (!inst) return null;
  const players = inst.seats.flatMap((x) => x.personIds).filter((p) => PEOPLE.some((q) => q.id === p));
  const lead = s.suspended === gameId ? "Suspended" : inst.status === "completed" ? "Last time" : g.shape === "live" ? "Game night" : "Paused at";
  return { lead, title: inst.title, detail: inst.detail, players, when: when(inst.updatedAt) };
}

/** Roles come from the manifest: grown-ups take grown-up roles in turn, kids the kid role, the littlest the little role (or the kid role as a helper). */
export function rolesFor(gameId: string, roster: string[]): { pid: string; label: string }[] {
  const g = game(gameId);
  const of = (a: string) => g.roles.filter((r) => r.audience === a);
  const grown = of("grownup");
  let gi = 0;
  return roster.map((pid) => {
    const band = personOf(pid).band;
    if (band === "grownup") {
      const r = grown[gi % Math.max(grown.length, 1)];
      gi++;
      return { pid, label: r?.label ?? "Player" };
    }
    const kid = of("kid")[0];
    if (band === "little") {
      const little = of("little")[0];
      return { pid, label: little ? little.label : `${kid?.label ?? "Player"} · helper` };
    }
    return { pid, label: kid?.label ?? "Player" };
  });
}

export const defaultPick = (gameId: string | null, s: S): string[] => {
  if (s.tonight.length) return s.tonight;
  if (!gameId) return [];
  const inst = instanceOf(gameId);
  const last = inst ? inst.seats.flatMap((x) => x.personIds).filter((p) => PEOPLE.some((q) => q.id === p)) : [];
  return last.length ? last : ["dad"];
};

export function detailButtons(gameId: string): { id: "continue" | "new" | "players"; label: string }[] {
  const g = game(gameId);
  if (g.shape === "live") return [{ id: "continue", label: "Rejoin game night" }];
  const inst = instanceOf(gameId);
  const resumable = inst && (inst.status === "active" || inst.status === "suspended");
  return [
    { id: "continue", label: resumable ? "Continue" : "Play" },
    { id: "new", label: "New game" },
    { id: "players", label: "Who's playing" },
  ];
}

export const DEFAULT_ORDER = ["rocket-crew", "bake-shop", "story-nook", "peekaboo-garden", "night-flight", "hearthisle", "word-duel"];

export function base(): S {
  return {
    cast: "on",
    view: { kind: "home" },
    focus: { zone: "games", games: 0, system: 0, users: 0 },
    order: DEFAULT_ORDER,
    phoneMode: "remote",
    coach: false,
    tonight: [],
    picking: [],
    suspended: null,
    savedNote: null,
    duel: null,
    duelsDone: [],
    remoteHolder: "dad",
    viewer: "dad",
    dadAsleep: false,
    lastPress: null,
    kidSeat: "juneau",
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function launch(s: S, gameId: string, roster: string[]): S {
  const saved = s.suspended && s.suspended !== gameId ? s.suspended : null;
  const note = saved ? `${game(saved).name} saved at ${instanceOf(saved)?.title.split(" · ")[0] ?? "its last point"}` : null;
  return {
    ...s,
    view: { kind: "game", gameId, phase: "starting" },
    order: [gameId, ...s.order.filter((x) => x !== gameId)],
    tonight: roster,
    picking: roster,
    suspended: null,
    savedNote: note,
    focus: { ...s.focus, zone: "games", games: 0 },
  };
}

export function openGame(s: S, gameId: string): S {
  if (game(gameId).shape === "async") return { ...s, view: { kind: "turns", focus: 0 }, focus: { ...s.focus, zone: "games", games: s.order.indexOf(gameId) } };
  return { ...s, view: { kind: "detail", gameId, focus: 0 }, focus: { ...s.focus, zone: "games", games: Math.max(0, s.order.indexOf(gameId)) } };
}

export function choose(s: S, gameId: string, which: "continue" | "new" | "players"): S {
  if (which === "continue" && (s.tonight.length || game(gameId).shape === "live")) return launch(s, gameId, s.tonight.length ? s.tonight : defaultPick(gameId, s));
  return { ...s, view: { kind: "who", gameId, mode: which === "new" ? "new" : "continue", focus: PEOPLE.length }, picking: defaultPick(gameId, s) };
}

export function togglePick(s: S, pid: string): S {
  const picking = s.picking.includes(pid) ? s.picking.filter((x) => x !== pid) : PEOPLE.map((p) => p.id).filter((id) => id === pid || s.picking.includes(id));
  return { ...s, picking };
}

export function startPicked(s: S): S {
  if (s.view.kind !== "who") return s;
  if (s.picking.length === 0) return s;
  if (s.view.gameId) return launch(s, s.view.gameId, s.picking);
  return { ...s, tonight: s.picking, view: { kind: "home" } };
}

export function goHome(s: S): S {
  if (s.view.kind === "game") {
    const gameId = s.view.gameId;
    return { ...s, view: { kind: "home" }, suspended: gameId, savedNote: null, focus: { ...s.focus, zone: "games", games: Math.max(0, s.order.indexOf(gameId)) } };
  }
  return { ...s, view: { kind: "home" }, duel: null, focus: { ...s.focus, zone: "games" } };
}

export function playDuel(s: S, id: string): S {
  return { ...s, duel: id, view: { kind: "turns", focus: Math.max(0, yourTurnDuels(s.duelsDone).findIndex((d) => d.id === id)) } };
}

/** The Joy-Con remote: every button moves the one focus on the TV. */
export function press(s0: S, b: Btn): S {
  const s = { ...s0, lastPress: b };
  const v = s.view;
  if (b === "home") return goHome(s);
  if (v.kind === "game") return s;
  if (v.kind === "home") {
    const f = s.focus;
    const counts: Record<Zone, number> = { users: PEOPLE.length, games: s.order.length, system: SYSTEM.length };
    if (b === "left" || b === "right") {
      const d = b === "left" ? -1 : 1;
      return { ...s, focus: { ...f, [f.zone]: clamp(f[f.zone] + d, 0, counts[f.zone] - 1) } };
    }
    if (b === "up") return { ...s, focus: { ...f, zone: f.zone === "system" ? "games" : "users" } };
    if (b === "down") return { ...s, focus: { ...f, zone: f.zone === "users" ? "games" : "system" } };
    if (b === "b") return { ...s, focus: { ...f, zone: "games" } };
    if (f.zone === "games") {
      const id = s.order[f.games];
      return id ? openGame(s, id) : s;
    }
    if (f.zone === "users") return { ...s, view: { kind: "who", gameId: null, mode: "continue", focus: f.users }, picking: s.tonight.length ? s.tonight : [] };
    const item = SYSTEM[f.system];
    if (item === "turns") return { ...s, view: { kind: "turns", focus: 0 } };
    if (item === "night") return openGame(s, "hearthisle");
    if (item === "family") return { ...s, view: { kind: "who", gameId: null, mode: "continue", focus: 0 }, picking: s.tonight };
    if (item === "devices") return { ...s, view: { kind: "devices" } };
    return { ...s, cast: "off", view: { kind: "home" } };
  }
  if (v.kind === "detail") {
    const n = detailButtons(v.gameId).length;
    if (b === "b") return { ...s, view: { kind: "home" } };
    if (b === "up" || b === "left") return { ...s, view: { ...v, focus: clamp(v.focus - 1, 0, n - 1) } };
    if (b === "down" || b === "right") return { ...s, view: { ...v, focus: clamp(v.focus + 1, 0, n - 1) } };
    const which = detailButtons(v.gameId)[v.focus]?.id ?? "continue";
    return choose(s, v.gameId, which);
  }
  if (v.kind === "who") {
    const start = PEOPLE.length;
    if (b === "b") return v.gameId ? { ...s, view: { kind: "detail", gameId: v.gameId, focus: 0 } } : { ...s, view: { kind: "home" } };
    if (b === "left") return { ...s, view: { ...v, focus: v.focus === start ? start - 1 : clamp(v.focus - 1, 0, start) } };
    if (b === "right") return { ...s, view: { ...v, focus: clamp(v.focus + 1, 0, start) } };
    if (b === "down") return { ...s, view: { ...v, focus: start } };
    if (b === "up") return { ...s, view: { ...v, focus: v.focus === start ? start - 1 : v.focus } };
    if (v.focus === start) return startPicked(s);
    const p = PEOPLE[v.focus];
    return p ? togglePick(s, p.id) : s;
  }
  if (v.kind === "turns") {
    const n = yourTurnDuels(s.duelsDone).length;
    if (b === "b") return { ...s, view: { kind: "home" }, duel: null };
    if (b === "left" || b === "up") return { ...s, view: { ...v, focus: clamp(v.focus - 1, 0, Math.max(n - 1, 0)) } };
    if (b === "right" || b === "down") return { ...s, view: { ...v, focus: clamp(v.focus + 1, 0, Math.max(n - 1, 0)) } };
    const d = yourTurnDuels(s.duelsDone)[v.focus];
    return d ? playDuel(s, d.id) : s;
  }
  if (v.kind === "devices") return b === "b" || b === "a" ? { ...s, view: { kind: "home" } } : s;
  return s;
}

export function finishDuel(s: S): S {
  if (!s.duel) return s;
  const duelsDone = [...s.duelsDone, s.duel];
  return { ...s, duel: null, duelsDone, view: yourTurnDuels(duelsDone).length ? { kind: "turns", focus: 0 } : { kind: "home" } };
}

/** What the TV's focus is on, in words, for the phone's "on the TV" line. */
export function focusLabel(s: S): string {
  const v = s.view;
  if (v.kind === "detail") return `${game(v.gameId).name} · ${detailButtons(v.gameId)[v.focus]?.label ?? ""}`;
  if (v.kind === "who") return v.focus >= PEOPLE.length ? "Who's playing · Start" : `Who's playing · ${PEOPLE[v.focus]?.name ?? ""}`;
  if (v.kind === "turns") return `Your turn · ${yourTurnDuels(s.duelsDone)[v.focus]?.opponent ?? ""}`;
  if (v.kind === "devices") return "Phones & iPads";
  if (v.kind === "game") return game(v.gameId).name;
  const f = s.focus;
  if (f.zone === "users") return PEOPLE[f.users]?.name ?? "";
  if (f.zone === "system") return SYSTEM_LABEL[SYSTEM[f.system] ?? "turns"];
  const id = s.order[f.games];
  return id ? game(id).name : "";
}

export const SYSTEM_LABEL: Record<SystemItem, string> = {
  turns: "Your turn",
  night: "Game night",
  family: "Who's here",
  devices: "Phones & iPads",
  stop: "Stop casting",
};
