// The activity deck: every game the family has open (couch saves, game nights, duels) as one
// ordering, "what needs you now" first. No lanes: the TV card leads (it is what the console is
// showing, or what Play on TV would start), then whatever someone is waiting on you for, then
// tonight's plans, then new things, paused saves, games ready to start, and games waiting on
// someone else. Finished games sit at the end of the list view only.
// Game-agnostic: every field comes from what a game reports (status.ts, inbox.ts) or its manifest.
import { COUCH, gameById } from "../../world";
import { everyGame, type TurnItem } from "./inbox";
import { nightLine, nightStatus, type Night } from "./nights";
import { pointIn, saveOf, type S } from "./state";
import { couchLine, couchStatus, type Status, type StatusKind } from "./status";

export type CardKind = "couch" | "night" | "duel";

export interface DeckCard {
  /** Stable key, and the card's data-bot ("act-bake-shop", "turn-wd-1", "night-hi-1"). */
  id: string;
  gameId: string;
  kind: CardKind;
  status: Status;
  /** What kind of thing this is, in a few words: "Couch game", "Game night · 3 homes", "Word Duel · 23 min ago". */
  kicker: string;
  /** The card's big words: a game's name, or what happened ("Nana played QUILT for 34"). */
  title: string;
  /** Where it stands: "Mission 6", "Saved Tuesday", "Turn 14 · Nana & Pop to roll". */
  line: string;
  /** The TV card: what the console is showing (or would start). */
  tv: boolean;
  /** Ordering: lower is sooner. */
  rank: number;
  at: string;
  duel?: string;
  night?: string;
  /** Opening a list row/card for a turn item (duels and nights). */
  turn?: TurnItem;
}

const RANK: Record<StatusKind, number> = { live: 0, yours: 1, coming: 2, invited: 2, new: 3, paused: 4, ready: 5, theirs: 6, done: 7, closed: 7 };

/** The game the TV card is about: the one on the TV, else the console's focus. */
export const tvGame = (s: S): string => s.onTv ?? s.tvFocus;

function couchCards(s: S): DeckCard[] {
  const focus = tvGame(s);
  return COUCH.map((i): DeckCard => {
    const status = couchStatus(i.gameId, s.onTv, s.savedTonight);
    const tv = i.gameId === focus;
    const fresh = s.fresh[i.gameId];
    const save = !fresh && saveOf(i.gameId);
    const line = s.onTv === i.gameId ? pointIn(s, i.gameId) : fresh ? "New game" : couchLine(i.gameId, s.onTv, s.savedTonight);
    const where = s.onTv === i.gameId ? "On the living room TV" : tv ? (s.cast === "off" ? "Ready for the TV" : "Up on the TV") : save ? "Couch game · saved" : "Couch game";
    return { id: `act-${i.gameId}`, gameId: i.gameId, kind: "couch", status, kicker: where, title: gameById(i.gameId).name, line, tv, rank: tv ? -1 : RANK[status.kind], at: i.updatedAt };
  });
}

function nightCard(n: Night, s: S, item: TurnItem | undefined): DeckCard {
  const status = nightStatus(n, s.onTv);
  const homes = n.homes.filter((h) => h.reply !== "declined").length;
  return {
    id: `night-${n.id}`,
    gameId: n.gameId,
    kind: "night",
    status,
    kicker: `Game night · ${homes} homes`,
    title: gameById(n.gameId).name,
    line: nightLine(n),
    tv: s.onTv === n.gameId && n.status === "live",
    rank: s.onTv === n.gameId && n.status === "live" ? -1 : RANK[status.kind],
    at: item?.at ?? "2026-10-03T17:00:00-07:00",
    night: n.id,
    turn: item,
  };
}

function duelCard(t: TurnItem): DeckCard {
  return { id: t.id, gameId: t.gameId, kind: "duel", status: t.status, kicker: t.detail, title: t.title, line: "", tv: false, rank: RANK[t.status.kind], at: t.at, duel: t.duel, turn: t };
}

/** Everything, in one order. `withDone` adds finished and closed games (the list view). */
export function deck(s: S, withDone = false): DeckCard[] {
  const all = everyGame(s);
  const items = [...all.tv, ...all.yours, ...all.coming, ...all.theirs, ...all.paused, ...all.done];
  const nights = s.nights.list.map((n) => nightCard(n, s, items.find((t) => t.id === `night-${n.id}`)));
  const duels = items.filter((t) => t.duel).map(duelCard);
  const cards = [...couchCards(s), ...nights, ...duels].filter((c) => withDone || c.rank < 7);
  return cards.sort((a, b) => a.rank - b.rank || b.at.localeCompare(a.at));
}

/** How many cards are waiting on you (your turn, your roll). */
export const needsYou = (cards: DeckCard[]): number => cards.filter((c) => c.status.kind === "yours").length;
