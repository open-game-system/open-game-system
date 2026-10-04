// Everything the phone (room miniature or remote) can do to the session. Pure: S → S.
import { gameById } from "../../world";
import { COUCH_GAMES, OPEN_DUELS, people, personOf, type S, type View } from "./state";

const personBand = (id: string) => personOf(id).band;

/** Where each room object sits on the 1920×1080 TV; the remote moves the spotlight by these. */
export const SPOT: Record<string, { x: number; y: number; r: number }> = {
  night: { x: 1510, y: 300, r: 380 },
  ...Object.fromEntries(COUCH_GAMES.map((g, i) => [`g:${g.id}`, { x: 280 + i * 340, y: 660, r: 260 }])),
  ...Object.fromEntries(OPEN_DUELS.map((d, i) => [`d:${d.id}`, { x: 255 + i * 320, y: 320, r: 230 }])),
};

type Dir = "up" | "down" | "left" | "right";

function rows(s: S): string[][] {
  if (s.view.kind === "detail") return [["continue", "new"], people.map((p) => `p:${p.id}`)];
  if (s.view.kind === "night") return [["join"]];
  if (s.view.kind !== "room") return [];
  const notes = OPEN_DUELS.filter((d) => !s.duelsDone.includes(d.id)).map((d) => `d:${d.id}`);
  return [[...notes, "night"], COUCH_GAMES.map((g) => `g:${g.id}`)];
}

const xOf = (id: string, row: string[]): number => SPOT[id]?.x ?? (row.indexOf(id) + 0.5) / row.length;

export function move(s: S, dir: Dir): S {
  const rs = rows(s);
  const r = rs.findIndex((row) => row.includes(s.focus));
  if (r < 0) return s;
  const row = rs[r] ?? [];
  const c = row.indexOf(s.focus);
  let next = s.focus;
  if (dir === "left") next = row[Math.max(0, c - 1)] ?? s.focus;
  if (dir === "right") next = row[Math.min(row.length - 1, c + 1)] ?? s.focus;
  if (dir === "up" || dir === "down") {
    const target = rs[dir === "up" ? r - 1 : r + 1];
    if (target && target.length > 0) {
      const fx = s.view.kind === "room" ? xOf(s.focus, row) : (c + 0.5) / row.length;
      const scored = target.map((id) => ({ id, d: Math.abs((s.view.kind === "room" ? xOf(id, target) : (target.indexOf(id) + 0.5) / target.length) - fx) }));
      scored.sort((a, b) => a.d - b.d);
      next = scored[0]?.id ?? s.focus;
    }
  }
  return { ...s, focus: next, fresh: false, note: undefined };
}

/** Open whatever a room object is: a game's box, the game-night window, a Word Duel note. */
export function open(s: S, id: string): S {
  const base: S = { ...s, fresh: false, note: undefined, roomFocus: id };
  if (id === "night") return { ...base, view: { kind: "night" }, focus: "join" };
  if (id.startsWith("d:")) return { ...base, view: { kind: "duel", duelId: id.slice(2) }, focus: id, tiles: [] };
  if (id.startsWith("g:")) {
    const gameId = id.slice(2);
    const saved = s.saves[gameId];
    // The phone holding the remote plays the grown-up seat; the kids come from the save.
    const kids = saved && saved.crew.length > 0 ? saved.crew.filter((p) => personBand(p) !== "grownup") : ["juneau", "ava"];
    const pick = [s.holder, ...kids];
    return { ...base, view: { kind: "detail", gameId }, focus: "continue", pick };
  }
  return s;
}

export function start(s: S, gameId: string, fresh: boolean): S {
  const saved = s.saves[gameId];
  const at = fresh || !saved ? "New game" : saved.at;
  return {
    ...s,
    view: { kind: "game", gameId },
    crew: s.pick,
    saves: { ...s.saves, [gameId]: { at, when: "Playing now", crew: s.pick } },
    note: undefined,
  };
}

export function togglePerson(s: S, id: string): S {
  const pick = s.pick.includes(id) ? s.pick.filter((p) => p !== id) : [...s.pick, id];
  return { ...s, pick };
}

export function ok(s: S): S {
  if (s.view.kind === "room") return open(s, s.focus);
  if (s.view.kind === "detail") {
    if (s.focus === "continue") return start(s, s.view.gameId, false);
    if (s.focus === "new") return start(s, s.view.gameId, true);
    if (s.focus.startsWith("p:")) return { ...togglePerson(s, s.focus.slice(2)), focus: s.focus };
  }
  if (s.view.kind === "night") return { ...s, view: { kind: "game", gameId: "hearthisle" }, crew: ["dad", "juneau"] };
  return s;
}

/** OGS Home: the game folds back into its box with its resume point; the room comes back. */
export function home(s: S): S {
  const v = s.view;
  if (v.kind === "game") {
    const saved = s.saves[v.gameId];
    const name = gameById(v.gameId).name;
    const saves = saved ? { ...s.saves, [v.gameId]: { ...saved, when: "Paused just now", crew: s.crew } } : s.saves;
    const at = saved?.at ?? "turn 14";
    const focus = saved ? `g:${v.gameId}` : "night";
    return { ...s, view: { kind: "room" }, focus, roomFocus: focus, saves, crew: [], note: `${name} paused at ${at}` };
  }
  return { ...s, view: { kind: "room" }, focus: s.roomFocus, note: undefined };
}

export function back(s: S): S {
  if (s.view.kind === "room" || s.view.kind === "game") return s;
  return home(s);
}

export function playWord(s: S, duelId: string): S {
  return { ...s, duelsDone: [...s.duelsDone, duelId], view: { kind: "room" }, focus: "g:rocket-crew", roomFocus: "g:rocket-crew", tiles: [], note: "Word sent. Your move is on its way" };
}

export function drop(s: S): S {
  return { ...s, cast: "dropped", resumeView: s.view };
}

export function connected(s: S): S {
  const v: View = s.resumeView ?? { kind: "room" };
  return { ...s, cast: "live", view: v, fresh: !s.resumeView, resumeView: undefined };
}
