// Session state for "Our living room": one couch session that owns the cast. The TV shows the
// family's room (the launcher); games open inside it and fold back into their box on Home.
import { COUCH, DUELS, GAMES, HOME, NOW, type GameManifest, type Instance, type Person } from "../../world";

export type Cast = "off" | "picking" | "searching" | "none-found" | "connecting" | "live" | "dropped";

export type View =
  | { kind: "room" }
  | { kind: "detail"; gameId: string }
  | { kind: "night" }
  | { kind: "game"; gameId: string }
  | { kind: "duel"; duelId: string };

/** How the phone shows the controller: the room and the remote together, or just the big remote. */
export type Layout = "both" | "remote";

export interface Saved {
  /** The game's own resume line, e.g. "Mission 6". */
  at: string;
  /** When it was put back on the shelf, in words. */
  when: string;
  crew: string[];
}

export interface S {
  cast: Cast;
  /** Nobody has moved the spotlight since the TV lit up. */
  fresh: boolean;
  view: View;
  /** What the spotlight is on: "g:<game>", "d:<duel>", "night", or in a detail page "continue" | "new" | "p:<person>". */
  focus: string;
  /** The room's spotlight goes back here when a detail page closes. */
  roomFocus: string;
  saves: Record<string, Saved>;
  /** Who is seated for the detail page that's open. */
  pick: string[];
  /** Who is in the running game. */
  crew: string[];
  layout: Layout;
  /** Whose phone holds the remote, and whose phone this surface is. */
  holder: string;
  phoneOf: string;
  asleep: boolean;
  duelsDone: string[];
  tiles: number[];
  /** A short line the phone shows after something happened (paused, sent). */
  note?: string;
  /** Where the cast was when it dropped, so re-casting lands back there. */
  resumeView?: View;
}

export const COUCH_GAMES: GameManifest[] = GAMES.filter((g) => g.shape === "couch");
export const OPEN_DUELS = DUELS.filter((d) => d.status === "yourTurn");

export const instanceFor = (gameId: string): Instance | undefined => COUCH.find((i) => i.gameId === gameId);

/** The resume line a game reported, cut to its first clause ("Mission 6 · Navigator rank" → "Mission 6"). */
export const resumeLine = (i: Instance): string => i.title.split(" · ")[0] ?? i.title;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "today 7:02", "yesterday", or the weekday, from the time the game last reported. */
function dayOf(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(NOW) - startOfDay(d)) / 86400000);
  if (days <= 0) return `at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).replace(" PM", "").replace(" AM", "")}`;
  if (days === 1) return "yesterday";
  return DAYS[d.getDay()] ?? "";
}
const startOfDay = (d: Date) => new Date(d.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })).getTime();

function savedFrom(i: Instance): Saved {
  const day = dayOf(i.updatedAt);
  const when = i.status === "suspended" ? `Paused ${day}` : i.status === "completed" && day.startsWith("at") ? "New today" : `Played ${day}`;
  return { at: resumeLine(i), when, crew: i.seats.flatMap((s) => s.personIds) };
}

export const initialSaves = (): Record<string, Saved> =>
  Object.fromEntries(COUCH.map((i) => [i.gameId, savedFrom(i)]));

export const people: Person[] = HOME.people;
export function personOf(id: string): Person {
  const p = people.find((x) => x.id === id);
  if (!p) throw new Error(`not in the household: ${id}`);
  return p;
}
export const grownups = people.filter((p) => p.band === "grownup");

/** The role a person takes in a game: their age band's role, or the kid role as a helper. */
export function roleFor(game: GameManifest, p: Person): string {
  const exact = game.roles.find((r) => r.audience === p.band);
  if (exact) return exact.label;
  if (p.band === "little") {
    const kid = game.roles.find((r) => r.audience === "kid");
    if (kid) return `${kid.label}'s helper`;
  }
  return game.roles[0]?.label ?? "Player";
}

export function base(over: Partial<S> = {}): S {
  return {
    cast: "live",
    fresh: false,
    view: { kind: "room" },
    focus: "g:rocket-crew",
    roomFocus: "g:rocket-crew",
    saves: initialSaves(),
    pick: [],
    crew: [],
    layout: "both",
    holder: "dad",
    phoneOf: "dad",
    asleep: false,
    duelsDone: [],
    tiles: [],
    ...over,
  };
}
