// "Your turn": one inbox across every game that has turns. A duel move and a game-night roll sit in
// the same list, newest first, because to a grown-up they are the same thing: someone is waiting
// on me. Game-agnostic: an item comes from what an instance reports (whose turn, last move, URL).
import { gameById, type DuelGame } from "../../world";
import { homeName, isOurs, nightLine, nightStatus, short, US, type Night } from "./nights";
import type { S } from "./state";
import { bucketOf, CLOSED, DONE, THEIRS, YOURS, type Bucket, type Status } from "./status";
import { ago } from "./ui/time";

/** Where an item opens: a duel's board, a night's page, or a game's own list (finished games). */
export type TurnTarget = { kind: "duel"; id: string } | { kind: "night"; id: string } | { kind: "duels" };

export interface TurnItem {
  id: string;
  gameId: string;
  /** What happened, in the game's words: "Nana played QUILT for 34". */
  title: string;
  /** "Word Duel · 23 min ago". */
  detail: string;
  status: Status;
  /** What opening it does. */
  target: TurnTarget;
  at: string;
  /** For duel rows: the duel, so the row can show the opponent's sticker and a tiny board. */
  duel?: string;
}

/** A game night as one item, in whichever bucket its status puts it. */
function nightItem(n: Night, onTv: string | null): TurnItem {
  const status = nightStatus(n, onTv);
  const others = n.homes.filter((h) => h.householdId !== US && h.reply !== "declined").length;
  const name = gameById(n.gameId).name;
  const title =
    status.kind === "live" ? (isOurs(n) ? "Your roll, on the living room TV" : `Game night on the TV · ${nightLine(n)}`)
    : status.kind === "yours" ? `Your roll · ${others} homes waiting`
    : status.kind === "theirs" ? `${short(homeName(n, n.turnOf))} are rolling`
    : status.kind === "invited" ? `New game night · ${n.homes.filter((h) => h.reply === "invited").length} invites out`
    : `Game night · ${n.homes.length} homes`;
  const detail = `${name} · ${status.kind === "coming" || status.kind === "invited" ? nightLine(n) : `turn ${n.turn}`}`;
  return { id: `night-${n.id}`, gameId: n.gameId, title, detail, status, target: { kind: "night", id: n.id }, at: n.status === "live" ? "2026-10-03T19:09:00-07:00" : "2026-10-03T17:00:00-07:00" };
}

function duelItem(d: DuelGame): TurnItem {
  if (d.status === "yourTurn") return { id: `turn-${d.id}`, gameId: "word-duel", title: d.lastMove, detail: `Word Duel · ${ago(d.updatedAt)}`, status: YOURS, target: { kind: "duel", id: d.id }, at: d.updatedAt, duel: d.id };
  if (d.status === "waiting") return { id: `wait-${d.id}`, gameId: "word-duel", title: `${d.opponent}'s move`, detail: `Word Duel · you played ${d.lastWord ?? ""} · ${ago(d.updatedAt)}`, status: THEIRS, target: { kind: "duel", id: d.id }, at: d.updatedAt, duel: d.id };
  const won = d.you > d.them;
  return {
    id: `done-${d.id}`,
    gameId: "word-duel",
    title: d.status === "expired" ? `${d.opponent} · closed` : `${d.opponent} · ${won ? "you won" : "they won"} by ${Math.abs(d.you - d.them)}`,
    detail: d.status === "expired" ? "Word Duel · no move in 14 days" : `Word Duel · ${ago(d.updatedAt)}`,
    status: d.status === "expired" ? CLOSED : DONE,
    target: { kind: "duels" },
    at: d.updatedAt,
    duel: d.id,
  };
}

/** Every game with turns (duels and game nights), each in exactly one bucket (status.ts bucketOf). */
export function everyGame(s: S): Record<Bucket, TurnItem[]> {
  const out: Record<Bucket, TurnItem[]> = { tv: [], yours: [], coming: [], theirs: [], paused: [], done: [] };
  const items = [...s.nights.list.map((n) => nightItem(n, s.onTv)), ...s.duels.map(duelItem)];
  for (const t of items) out[bucketOf(t.status)].push(t);
  for (const k of ["yours", "theirs", "done"] as const) out[k].sort((a, b) => b.at.localeCompare(a.at));
  return out;
}

/** Waiting on you, across games: duels on your move and game nights on your roll (not on the TV). */
export const inbox = (s: S): TurnItem[] => everyGame(s).yours;
/** Waiting on someone else. */
export const waiting = (s: S): TurnItem[] => everyGame(s).theirs;
/** Finished and closed: kept for a week, then they leave the list. */
export const finished = (s: S): TurnItem[] => everyGame(s).done;
/** Game nights with a time set (and new ones waiting on replies). */
export const comingUp = (s: S): TurnItem[] => everyGame(s).coming;

/** "Next: …" after a move: the next thing waiting on you, in any game. */
export function nextTurn(s: S, after: string): TurnItem | undefined {
  return inbox(s).find((t) => t.id !== `turn-${after}`);
}

export function nextLabel(t: TurnItem, s: S): string {
  if (t.target.kind === "night") return `Next: your roll in ${gameById(t.gameId).name}`;
  const id = t.target.kind === "duel" ? t.target.id : "";
  const d = s.duels.find((x) => x.id === id);
  return d ? `Next: ${d.opponent}'s game · your turn` : "Next game";
}
