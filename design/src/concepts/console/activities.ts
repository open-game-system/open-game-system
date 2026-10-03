// Activity cards: what each game instance reports, turned into one line of status. Game-agnostic:
// everything here comes from the instance (Tier 1/2) or the manifest (Tier 0).
import { COUCH, HEARTHISLE, gameById, type Instance } from "../../world";
import type { S } from "./state";

export interface Activity {
  id: string;
  gameId: string;
  /** Short badge on the art: "Tonight 8:00", "New", "Paused". */
  badge: string;
  badgeTone: "signal" | "quiet" | "live";
  title: string;
  detail: string;
}

function fromInstance(i: Instance, s: S): Activity {
  const saved = s.savedTonight[i.gameId];
  if (s.onTv === i.gameId) return { id: i.id, gameId: i.gameId, badge: "On the TV", badgeTone: "live", title: i.title.split(" · ")[0] ?? i.title, detail: "Playing now in the living room" };
  if (saved) return { id: i.id, gameId: i.gameId, badge: `Saved ${saved}`, badgeTone: "quiet", title: i.title.split(" · ")[0] ?? i.title, detail: "Picks up right where you left it" };
  if (i.status === "active") return { id: i.id, gameId: i.gameId, badge: "In progress", badgeTone: "live", title: i.title.split(" · ")[0] ?? i.title, detail: i.detail.split(" · ")[0] ?? i.detail };
  if (i.status === "suspended") {
    const [when, ...rest] = i.detail.split(" · ");
    return { id: i.id, gameId: i.gameId, badge: when ?? "Paused", badgeTone: "quiet", title: i.title, detail: rest.join(" · ") };
  }
  if (i.status === "completed" && i.updatedAt > "2026-10-03") return { id: i.id, gameId: i.gameId, badge: "New", badgeTone: "signal", title: i.title, detail: i.detail.split(" · ")[0] ?? i.detail };
  return { id: i.id, gameId: i.gameId, badge: "", badgeTone: "quiet", title: i.title, detail: i.detail.split(" · ")[0] ?? i.detail };
}

/** Home "Jump back in": tonight's game night first, then the newest news, then paused games. */
export function activities(s: S): Activity[] {
  const night: Activity = {
    id: HEARTHISLE.id,
    gameId: HEARTHISLE.gameId,
    badge: "Tonight 8:00",
    badgeTone: "signal",
    title: "Game night · turn 14",
    detail: "Okafors are in · Nana & Pop to roll",
  };
  const couch = COUCH.filter((i) => i.gameId !== s.onTv).map((i) => fromInstance(i, s));
  const order = (a: Activity) => (a.badge.startsWith("Saved") ? 0 : a.badgeTone === "signal" ? 1 : a.badgeTone === "quiet" && a.badge ? 2 : 3);
  return [night, ...couch.sort((a, b) => order(a) - order(b))];
}

export const artFor = (gameId: string): string => {
  const g = gameById(gameId);
  return g.art.alt ?? g.art.tv;
};
