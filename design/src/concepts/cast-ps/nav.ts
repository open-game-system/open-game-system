// The remote's grammar: four directions, click, Back, Home. Pure functions over the session.
import { HOME } from "../../world";
import { ROW, hubFor, instanceFor, resumeShort, rowIndex, switchTargets, type HubAction, type HubCard } from "./data";
import type { S } from "./state";

export type Dir = "up" | "down" | "left" | "right";
const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));

export const PICK_PEOPLE = HOME.people;
export const focusedGame = (s: S) => ROW[s.row] ?? ROW[0]!;
export const hubOf = (s: S) => hubFor(focusedGame(s), s.suspended, s.duelsPlayed);
export const ccItems = (s: S, current: string) => [current, ...switchTargets(current, s.suspended).map((g) => g.id)];

export function move(s: S, dir: Dir): S {
  const tv = s.tv;
  if (tv.kind === "picker") {
    const last = PICK_PEOPLE.length;
    if (dir === "down") return { ...s, pickI: last };
    if (dir === "up") return s.pickI === last ? { ...s, pickI: 0 } : s;
    return { ...s, pickI: clamp(s.pickI + (dir === "right" ? 1 : -1), last) };
  }
  if (tv.kind === "control") {
    if (dir === "left" || dir === "right") return { ...s, ccI: clamp(s.ccI + (dir === "right" ? 1 : -1), ccItems(s, tv.gameId).length - 1) };
    return s;
  }
  if (tv.kind !== "launcher") return s;
  const hub = hubOf(s);
  const zones = (["row", "actions", "cards"] as const).filter((z) => z === "row" || (z === "actions" ? hub.actions.length : hub.cards.length));
  const zIdx = zones.indexOf(s.zone);
  if (dir === "down" || dir === "up") {
    const next = zones[clamp(zIdx + (dir === "down" ? 1 : -1), zones.length - 1)] ?? "row";
    return next === s.zone ? s : { ...s, zone: next, zi: 0, fresh: false };
  }
  const delta = dir === "right" ? 1 : -1;
  if (s.zone === "row") return { ...s, row: clamp(s.row + delta, ROW.length - 1), zi: 0, fresh: false, notice: undefined };
  const len = s.zone === "actions" ? hub.actions.length : hub.cards.length;
  return { ...s, zi: clamp(s.zi + delta, len - 1) };
}

function openPicker(s: S, gameId: string, fresh: boolean): S {
  return { ...s, tv: { kind: "picker", gameId, fresh }, pickI: PICK_PEOPLE.length, notice: undefined };
}

export function doAction(s: S, a: HubAction): S {
  const g = focusedGame(s);
  if (a.kind === "continue" || a.kind === "play") return openPicker(s, g.id, false);
  if (a.kind === "new") return openPicker(s, g.id, true);
  return { ...s, notice: "Game night opens at 8 · the Okafors are in" };
}

export function doCard(s: S, c: HubCard): S {
  if (c.action.kind === "continue") return openPicker(s, focusedGame(s).id, false);
  if (c.action.kind === "duel") return { ...s, tv: { kind: "handoff", duelId: c.action.duelId, played: false } };
  return s;
}

export function startGame(s: S): S {
  if (s.tv.kind !== "picker") return s;
  const { gameId } = s.tv;
  const rest = { ...s.suspended };
  delete rest[gameId];
  return { ...s, tv: { kind: "game", gameId }, suspended: rest, fresh: false };
}

export function togglePerson(s: S, id: string): S {
  if (id === s.phone) return s; // the remote holder is always in
  return { ...s, playing: s.playing.includes(id) ? s.playing.filter((x) => x !== id) : [...s.playing, id] };
}

export function switchTo(s: S, from: string, to: string): S {
  const inst = instanceFor(from);
  const at = s.suspended[from] ?? inst?.title ?? "";
  return { ...s, tv: { kind: "switching", from, to }, suspended: { ...s.suspended, [from]: at }, row: rowIndex(to), zone: "row", zi: 0 };
}

export function select(s: S): S {
  const tv = s.tv;
  if (tv.kind === "picker") {
    const p = PICK_PEOPLE[s.pickI];
    return p ? togglePerson(s, p.id) : startGame(s);
  }
  if (tv.kind === "control") {
    const target = ccItems(s, tv.gameId)[s.ccI];
    if (!target || target === tv.gameId) return { ...s, tv: { kind: "game", gameId: tv.gameId } };
    return switchTo(s, tv.gameId, target);
  }
  if (tv.kind !== "launcher") return s;
  const hub = hubOf(s);
  if (s.zone === "row") {
    const first = hub.actions[0];
    if (first) return doAction(s, first);
    return hub.cards.length ? { ...s, zone: "cards", zi: 0 } : s;
  }
  if (s.zone === "actions") {
    const a = hub.actions[s.zi];
    return a ? doAction(s, a) : s;
  }
  const c = hub.cards[s.zi];
  return c ? doCard(s, c) : s;
}

export function back(s: S): S {
  const tv = s.tv;
  if (tv.kind === "picker" || tv.kind === "handoff") return { ...s, tv: { kind: "launcher" } };
  if (tv.kind === "control") return { ...s, tv: { kind: "game", gameId: tv.gameId } };
  if (tv.kind === "launcher" && s.zone !== "row") return { ...s, zone: "row", zi: 0 };
  return s;
}

export function home(s: S): S {
  const tv = s.tv;
  if (tv.kind === "game") return { ...s, tv: { kind: "control", gameId: tv.gameId }, ccI: 1 };
  if (tv.kind === "control") {
    const at = s.suspended[tv.gameId] ?? instanceFor(tv.gameId)?.title ?? "";
    return { ...s, tv: { kind: "launcher" }, suspended: { ...s.suspended, [tv.gameId]: at }, row: rowIndex(tv.gameId), zone: "row", zi: 0 };
  }
  return { ...s, tv: { kind: "launcher" }, zone: "row", zi: 0 };
}

/** What a click on the touchpad will do right now, in words (shown on the phone above the pad). */
export function clickHint(s: S): string {
  const tv = s.tv;
  if (tv.kind === "picker") {
    const p = PICK_PEOPLE[s.pickI];
    if (!p) return `Start with ${s.playing.length} players`;
    return p.id === s.phone ? `${p.name} holds the remote` : s.playing.includes(p.id) ? `Leave ${p.name} out` : `Add ${p.name}`;
  }
  if (tv.kind === "control") {
    const t = ccItems(s, tv.gameId)[s.ccI];
    if (!t || t === tv.gameId) return "Resume";
    const g = ROW.find((x) => x.id === t);
    const at = s.suspended[t] ?? instanceFor(t)?.title;
    return `Switch to ${g?.name ?? ""}${at && instanceFor(t)?.status !== "completed" ? ` · ${resumeShort(at)}` : ""}`;
  }
  if (tv.kind !== "launcher") return "";
  const hub = hubOf(s);
  if (s.zone === "row") return hub.actions[0]?.label ?? (hub.cards.length ? "Show your turns" : "");
  if (s.zone === "actions") return hub.actions[s.zi]?.label ?? "";
  const c = hub.cards[s.zi];
  if (!c) return "";
  return c.action.kind === "duel" ? "Play this turn on your phone" : c.action.kind === "continue" ? hub.actions[0]?.label ?? "Continue" : "Swipe to move";
}
