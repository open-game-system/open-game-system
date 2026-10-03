// "Your turn": one inbox across every game that has turns. A duel move and a game-night roll sit in
// the same list, newest first, because to a grown-up they are the same thing: someone is waiting
// on me. Game-agnostic: an item comes from what an instance reports (whose turn, last move, URL).
import { gameById } from "../../world";
import { isOurs, nightLine, nightStatus, short, type Night } from "./nights";
import type { S } from "./state";
import { CLOSED, DONE, st, type Status } from "./status";
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
}

function nightItem(n: Night, onTv: string | null): TurnItem {
  const live = n.status === "live" && onTv === n.gameId;
  const others = n.homes.filter((h) => h.householdId !== "hh-mumm").length;
  return {
    id: `turn-${n.id}`,
    gameId: n.gameId,
    title: live ? "Your roll, on the living room TV" : `Your roll · ${others} homes waiting`,
    detail: `${gameById(n.gameId).name} · ${nightLine(n).replace(" · your roll", "")}`,
    status: live ? st("live", "Live on TV") : st("yours", "Your turn"),
    target: { kind: "night", id: n.id },
    at: "2026-10-03T19:09:00-07:00",
  };
}

export function inbox(s: S): TurnItem[] {
  const duels = s.duels
    .filter((d) => d.status === "yourTurn")
    .map(
      (d): TurnItem => ({
        id: `turn-${d.id}`,
        gameId: "word-duel",
        title: d.lastMove,
        detail: `Word Duel · ${ago(d.updatedAt)}`,
        status: st("yours", "Your turn"),
        target: { kind: "duel", id: d.id },
        at: d.updatedAt,
      }),
    );
  const nights = s.nights.list.filter(isOurs).map((n) => nightItem(n, s.onTv));
  return [...nights, ...duels].sort((a, b) => b.at.localeCompare(a.at));
}

/** Games waiting on someone else, across games: duels on their move, game nights on another home. */
export function waiting(s: S): TurnItem[] {
  const duels = s.duels
    .filter((d) => d.status === "waiting")
    .map(
      (d): TurnItem => ({
        id: `wait-${d.id}`,
        gameId: "word-duel",
        title: `${d.opponent}'s move`,
        detail: `Word Duel · you played ${d.lastWord ?? ""} · ${ago(d.updatedAt)}`,
        status: st("theirs", "Their turn"),
        target: { kind: "duel", id: d.id },
        at: d.updatedAt,
      }),
    );
  const nights = s.nights.list
    .filter((n) => !isOurs(n) && n.status !== "setup")
    .map(
      (n): TurnItem => ({
        id: `wait-${n.id}`,
        gameId: n.gameId,
        title: `Game night · ${n.homes.length} homes`,
        detail: `${gameById(n.gameId).name} · ${nightLine(n).replace(/ · .*/, "")}`,
        status: nightStatus(n, s.onTv),
        target: { kind: "night", id: n.id },
        at: "2026-10-03T17:00:00-07:00",
      }),
    );
  return [...nights, ...duels];
}

/** Finished and closed games: kept for a week, then they leave the list. */
export function finished(s: S): TurnItem[] {
  return s.duels
    .filter((d) => d.status === "completed" || d.status === "expired")
    .map(
      (d): TurnItem => ({
        id: `done-${d.id}`,
        gameId: "word-duel",
        title: d.status === "expired" ? `${d.opponent} · closed` : `${d.opponent} · ${d.you > d.them ? "you won" : "they won"} by ${Math.abs(d.you - d.them)}`,
        detail: d.status === "expired" ? "Word Duel · no move in 14 days" : `Word Duel · ${ago(d.updatedAt)}`,
        status: d.status === "expired" ? CLOSED : DONE,
        target: { kind: "duels" },
        at: d.updatedAt,
      }),
    );
}

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
