// Every change to the session. Phone taps and remote presses both land here, so the TV follows either.
import type { Store } from "../../harness/store";
import { DUELS } from "../../world";
import { focused, PEOPLE, positionOf, rowsFor, type Item, type S } from "./state";

export type Dir = "up" | "down" | "left" | "right";

const clampCol = (s: S, row: number, col: number) => {
  const rows = rowsFor(s);
  const r = rows[row];
  return r ? Math.max(0, Math.min(col, r.items.length - 1)) : 0;
};

export function startItem(s: S, item: Item): S {
  if (item.kind === "duel" && item.duel) return { ...s, tv: "duel", duel: { id: item.duel.id, placed: [], sent: false }, fresh: false, focus: positionOf(s, item.id) };
  if (!s.rosterSet && item.game.shape === "couch") return { ...s, tv: "who", whoFocus: 2, focus: positionOf(s, item.id), fresh: false };
  return {
    ...s,
    tv: "game",
    fresh: false,
    focus: positionOf(s, item.id),
    keyboard: false,
    playing: { itemId: item.id, gameId: item.game.id, title: s.resume[item.game.id] ?? item.instance?.title ?? item.game.tagline },
  };
}

export function startNew(s: S, item: Item): S {
  const next = startItem(s, item);
  return next.playing ? { ...next, playing: { ...next.playing, title: "New game" }, resume: { ...next.resume, [item.game.id]: "New game · just started" } } : next;
}

/** Home: the game suspends at its resume point and the TV returns to the launcher, same stream. */
export function goHome(s: S): S {
  if (!s.playing) return { ...s, tv: "launcher", keyboard: false };
  const p = s.playing;
  const paused = [p.gameId, ...s.pausedTonight.filter((g) => g !== p.gameId)];
  const next: S = { ...s, tv: "launcher", playing: null, homeFrom: p.gameId, pausedTonight: paused, resume: { ...s.resume, [p.gameId]: p.title } };
  // Focus lands on the game you just left (now first in Continue).
  const inCont = rowsFor(next)[0]?.items.find((i) => i.game.id === p.gameId);
  return { ...next, focus: inCont ? positionOf(next, inCont.id) : { row: 0, col: 0 } };
}

export function press(s: S, dir: Dir): S {
  if (s.tv === "launcher") {
    const rows = rowsFor(s);
    if (dir === "left" || dir === "right") return { ...s, fresh: false, focus: { row: s.focus.row, col: clampCol(s, s.focus.row, s.focus.col + (dir === "right" ? 1 : -1)) } };
    const row = Math.max(0, Math.min(rows.length - 1, s.focus.row + (dir === "down" ? 1 : -1)));
    return { ...s, fresh: false, focus: { row, col: clampCol(s, row, s.focus.col) } };
  }
  if (s.tv === "detail") {
    if (dir === "left") return { ...s, detailBtn: 0 };
    if (dir === "right") return { ...s, detailBtn: 1 };
    return s;
  }
  if (s.tv === "who") {
    const last = PEOPLE.length;
    if (dir === "down") return { ...s, whoFocus: last };
    if (dir === "up") return { ...s, whoFocus: s.whoFocus === last ? 2 : s.whoFocus };
    if (s.whoFocus === last) return s;
    return { ...s, whoFocus: Math.max(0, Math.min(last - 1, s.whoFocus + (dir === "right" ? 1 : -1))) };
  }
  return s;
}

export function toggleWho(s: S, id: string): S {
  if (id === s.remoteHolder) return s;
  const on = s.tonight.includes(id);
  return { ...s, tonight: on ? s.tonight.filter((x) => x !== id) : [...s.tonight, id] };
}

export function confirmWho(s: S): S {
  const item = focused(s);
  const next: S = { ...s, rosterSet: true };
  return item ? startItem(next, item) : next;
}

export function ok(s: S): S {
  const item = focused(s);
  if (s.tv === "launcher") {
    if (!item) return s;
    if (item.kind === "duel") return startItem(s, item);
    return { ...s, tv: "detail", detailBtn: 0, fresh: false };
  }
  if (s.tv === "detail" && item) return s.detailBtn === 0 ? startItem(s, item) : startNew(s, item);
  if (s.tv === "who") {
    const p = PEOPLE[s.whoFocus];
    return p ? toggleWho(s, p.id) : confirmWho(s);
  }
  return s;
}

export function back(s: S): S {
  if (s.tv === "detail") return { ...s, tv: "launcher" };
  if (s.tv === "who") return { ...s, tv: "detail" };
  if (s.tv === "duel") return { ...s, tv: "launcher", duel: null };
  return s;
}

/** Phone browse: the first touch focuses an item on the TV, a second touch plays it. */
export function touchItem(s: S, item: Item): S {
  const cur = focused(s);
  if (cur?.id === item.id && s.tv === "launcher" && !s.fresh) return item.kind === "night" ? { ...s, tv: "detail", detailBtn: 0 } : startItem(s, item);
  return { ...s, tv: "launcher", fresh: false, homeFrom: null, focus: positionOf(s, item.id) };
}

export const DUEL_RACK = ["O", "W", "N", "E", "R", "S", "A"];
export const DUEL_WORD = "TOWN";

export function placeTile(s: S, letter: string): S {
  if (!s.duel || s.duel.sent || s.duel.placed.includes(letter)) return s;
  return { ...s, duel: { ...s.duel, placed: [...s.duel.placed, letter] } };
}

export function sendDuel(s: S): S {
  if (!s.duel) return s;
  return { ...s, duel: { ...s.duel, sent: true }, duelsDone: [...s.duelsDone, s.duel.id] };
}

export function leaveDuel(s: S): S {
  const nextTurn = DUELS.find((d) => d.status === "yourTurn" && !s.duelsDone.includes(d.id));
  const base: S = { ...s, tv: "launcher", duel: null };
  return nextTurn ? { ...base, focus: positionOf(base, `d-${nextTurn.id}`) } : { ...base, focus: { row: 0, col: 0 } };
}

/** Cast plumbing. The timers stand in for the Cast SDK's callbacks. */
export function connect(store: Store<S>, recast = false) {
  store.update((s) => ({ ...s, cast: "connecting", recast }));
  setTimeout(() => store.update((s) => (s.cast === "connecting" ? { ...s, cast: "live", fresh: s.before === "launcher" && !s.playing, tv: s.before, resumed: s.before === "game" } : s)), 1800);
  setTimeout(() => store.update((s) => ({ ...s, resumed: false })), 5200);
}
