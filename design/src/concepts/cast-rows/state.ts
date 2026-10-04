// Session state for "Netflix rows": one cast session, one launcher, games hosted inside it.
import { COUCH, DUELS, GAMES, HEARTHISLE, HOME, HOUSEHOLDS, type DuelGame, type GameManifest, type Instance, type Person } from "../../world";

export type CastStatus = "off" | "picking" | "none-found" | "connecting" | "live" | "dropped";
export type TvScreen = "launcher" | "detail" | "who" | "game" | "duel";
export type Mode = "browse" | "remote";

export type ItemKind = "couch" | "title" | "night" | "duel";
export interface Item {
  id: string;
  kind: ItemKind;
  game: GameManifest;
  instance?: Instance;
  duel?: DuelGame;
}
export interface Row {
  id: string;
  title: string;
  items: Item[];
}

export interface Playing {
  itemId: string;
  gameId: string;
  /** The resume point the game reported, shown while it runs. */
  title: string;
}

export interface S {
  cast: CastStatus;
  tv: TvScreen;
  /** Launcher focus: row and column. */
  focus: { row: number; col: number };
  /** The launcher just appeared and nobody has moved yet. */
  fresh: boolean;
  /** Detail page: 0 = Continue, 1 = New. */
  detailBtn: number;
  /** Who's playing: index into HOME.people, or people.length for Start. */
  whoFocus: number;
  /** Tonight's couch: asked once per night, kept across swaps. */
  tonight: string[];
  rosterSet: boolean;
  playing: Playing | null;
  /** Game id → resume line (the game's own words). Changes when a game is suspended. */
  resume: Record<string, string>;
  /** Game ids suspended tonight, most recent first (shown "Paused just now"). */
  pausedTonight: string[];
  mode: Mode;
  keyboard: boolean;
  /** Word Duel on the phone. */
  duel: { id: string; placed: string[]; sent: boolean } | null;
  duelsDone: string[];
  /** Whose phone the phone surface is. */
  phoneOwner: "dad" | "mom";
  remoteHolder: "dad" | "mom";
  remoteAsleep: boolean;
  /** The current connect is a re-cast after a drop (the phone keeps its place). */
  recast: boolean;
  /** The game Home just left (the TV shrinks it back into its card). */
  homeFrom: string | null;
  /** Re-cast landed: show the "back to" chip. */
  resumed: boolean;
  /** Which kid the single-iPad shot shows (the stage passes a seat instead). */
  ipadSeat: string;
  /** When the TV was on before the cast dropped (re-cast restores it). */
  before: TvScreen;
}

export const PEOPLE: Person[] = HOME.people;
export const personOf = (id: string): Person => HOUSEHOLDS.flatMap((h) => h.people).find((p) => p.id === id) ?? PEOPLE[0]!;

const couchGames = GAMES.filter((g) => g.shape === "couch");
const gameOf = (id: string): GameManifest => GAMES.find((g) => g.id === id) ?? GAMES[0]!;

/** Rows come from shapes and statuses only: no game id is special-cased. */
export function rowsFor(s: Pick<S, "duelsDone" | "pausedTonight" | "playing">): Row[] {
  const inProgress = COUCH.filter((i) => i.status === "active" || i.status === "suspended" || (i.save !== undefined && i.status === "completed" && i.updatedAt > "2026-10-03"));
  const order = [...inProgress].sort((a, b) => {
    const pa = s.pausedTonight.includes(a.gameId) ? 1 : 0;
    const pb = s.pausedTonight.includes(b.gameId) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const da = a.status === "completed" ? 1 : 0;
    const db = b.status === "completed" ? 1 : 0;
    if (da !== db) return da - db;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  const cont: Item[] = order.map((i) => ({ id: `c-${i.id}`, kind: "couch", game: gameOf(i.gameId), instance: i }));
  const turns: Item[] = DUELS.filter((d) => d.status === "yourTurn" && !s.duelsDone.includes(d.id)).map((d) => ({ id: `d-${d.id}`, kind: "duel", game: gameOf("word-duel"), duel: d }));
  const nights: Item[] = [{ id: `n-${HEARTHISLE.id}`, kind: "night", game: gameOf(HEARTHISLE.gameId), instance: HEARTHISLE }];
  const couch: Item[] = couchGames.map((g) => ({ id: `g-${g.id}`, kind: "title", game: g, instance: COUCH.find((i) => i.gameId === g.id) }));
  const library: Item[] = [...GAMES].sort((a, b) => a.name.localeCompare(b.name)).map((g) => ({ id: `l-${g.id}`, kind: "title", game: g, instance: COUCH.find((i) => i.gameId === g.id) }));
  const rows: Row[] = [
    { id: "continue", title: "Continue", items: cont },
    { id: "turns", title: "Your turn", items: turns },
    { id: "couch", title: "Couch games", items: couch },
    { id: "nights", title: "Game nights", items: nights },
    { id: "library", title: "Library", items: library },
  ];
  return rows.filter((r) => r.items.length > 0);
}

export function focused(s: S): Item | undefined {
  const rows = rowsFor(s);
  const row = rows[Math.min(s.focus.row, rows.length - 1)];
  if (!row) return undefined;
  return row.items[Math.min(s.focus.col, row.items.length - 1)];
}

export function positionOf(s: S, itemId: string): { row: number; col: number } {
  const rows = rowsFor(s);
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r]!.items.findIndex((i) => i.id === itemId);
    if (c >= 0) return { row: r, col: c };
  }
  return s.focus;
}

/** The resume line for an item: tonight's suspension wins over the stored instance title. */
export function resumeLine(s: S, item: Item): string | undefined {
  if (item.kind === "duel" && item.duel) return item.duel.lastMove;
  return s.resume[item.game.id] ?? item.instance?.title;
}

export function initial(over: Partial<S> = {}): S {
  const resume: Record<string, string> = {};
  for (const i of COUCH) resume[i.gameId] = i.title;
  return {
    cast: "live",
    tv: "launcher",
    focus: { row: 0, col: 0 },
    fresh: false,
    detailBtn: 0,
    whoFocus: 2,
    tonight: ["dad"],
    rosterSet: false,
    playing: null,
    resume,
    pausedTonight: [],
    mode: "browse",
    keyboard: false,
    duel: null,
    duelsDone: [],
    phoneOwner: "dad",
    remoteHolder: "dad",
    remoteAsleep: false,
    recast: false,
    homeFrom: null,
    resumed: false,
    ipadSeat: "juneau",
    before: "launcher",
    ...over,
  };
}

/** Kid role for a person in a game, by audience (manifest config): a little falls back to the kid role. */
export function roleFor(game: GameManifest, personId: string) {
  const p = personOf(personId);
  if (p.band === "grownup") return game.roles.find((r) => r.audience === "grownup");
  const own = game.roles.find((r) => r.audience === p.band);
  if (own) return own;
  const kid = game.roles.find((r) => r.audience === "kid");
  // A little in a game with no little role helps the kid role (manifest-driven, no game ids).
  return kid && p.band === "little" ? { ...kid, label: `${kid.label}'s helper` } : kid;
}

/** The audience a kid's controller is drawn for: "little" gets one giant button even in a kid-only game. */
export const controlsFor = (personId: string): "kid" | "little" => (personOf(personId).band === "little" ? "little" : "kid");
