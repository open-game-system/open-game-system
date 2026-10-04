// Activity cards: what each game reports, turned into one status (status.ts) and one line.
// Game-agnostic: everything here comes from what the game reports, or from its manifest.
import { COUCH, HEARTHISLE, gameById, type Instance } from "../../world";
import { nightLine, nightStatus } from "./nights";
import type { S } from "./state";
import { couchLine, couchStatus, type Status } from "./status";

export interface Activity {
  id: string;
  gameId: string;
  /** The status's words, for surfaces that show it as a kicker ("Paused at day 4", "New"). */
  badge: string;
  badgeTone: "signal" | "quiet" | "live";
  title: string;
  detail: string;
  /** The status in the shared vocabulary (glyph + shape + words), for chips. */
  status: Status;
}

const toneOf = (s: Status): Activity["badgeTone"] => (s.kind === "live" ? "live" : s.kind === "new" || s.kind === "coming" || s.kind === "yours" ? "signal" : "quiet");

function fromInstance(i: Instance, s: S): Activity {
  const status = couchStatus(i.gameId, s.onTv, s.savedTonight);
  return { id: i.id, gameId: i.gameId, badge: status.label, badgeTone: toneOf(status), title: i.title.split(" · ")[0] ?? i.title, detail: couchLine(i.gameId, s.onTv, s.savedTonight), status };
}

/** Home "Jump back in": tonight's game night first, then new things, then paused games, then the rest. */
export function activities(s: S): Activity[] {
  const n = s.nights.list.find((x) => x.id === HEARTHISLE.id);
  const status = n ? nightStatus(n, s.onTv) : nightStatusFallback();
  const night: Activity = { id: HEARTHISLE.id, gameId: HEARTHISLE.gameId, badge: status.label, badgeTone: toneOf(status), title: gameById(HEARTHISLE.gameId).name, detail: n ? nightLine(n) : "", status };
  const couch = COUCH.filter((i) => i.gameId !== s.onTv).map((i) => fromInstance(i, s));
  const order = (a: Activity) => (a.status.kind === "new" ? 0 : a.status.kind === "paused" ? 1 : 2);
  return [night, ...couch.sort((a, b) => order(a) - order(b))];
}

const nightStatusFallback = (): Status => ({ kind: "coming", label: "Tonight 8:00" });

/**
 * The couch shelf: this household's couch games only, for "On the TV tonight". Game nights live in
 * their own lane, so Hearthisle is not here. Prefer this over activities().
 */
export function couchShelf(s: S): Activity[] {
  return activities(s).filter((a) => a.gameId !== HEARTHISLE.gameId);
}

export const artFor = (gameId: string): string => {
  const g = gameById(gameId);
  return g.art.alt ?? g.art.tv;
};
