import type { Instance, Manifest, SessionState } from "@open-game-system/ogs-protocol";

/**
 * One sitting of a game you can get back into (owner: "you might have say multiple games of catan
 * going"). A game's page lists them, each with its own Rejoin.
 */
export interface Sitting {
  instanceId: string;
  /** Its resume point or title; empty when the game never said (the page reads "In progress"). */
  label: string;
  /** When it was last played, ms since epoch. */
  at: number;
  /** Where to send you back in, when the game (or the visit) recorded one. */
  resumeUrl: string | undefined;
  /** Live on the TV right now. */
  live: boolean;
}

const finished = (i: Instance) => i.status === "completed" || i.status === "expired";

/**
 * Every in-progress sitting of `game`: the profile's open instances of it (Playing's rules: not
 * finished or expired, touched within the game's TTL) plus the couch session's live and paused
 * sittings of it, merged by instance id. Live first, then most recently played.
 */
export function sittingsFor(
  game: Manifest,
  instances: Instance[],
  session: SessionState | null,
  now: number,
): Sitting[] {
  const mine = instances.filter((i) => i.appId === game.appId);
  const done = new Set(mine.filter(finished).map((i) => i.instanceId));
  const byId = new Map<string, Sitting>();
  for (const i of mine) {
    if (!finished(i) && now - i.updatedAt <= game.instanceTtlMs)
      byId.set(i.instanceId, fromInstance(i));
  }
  for (const g of couchSittings(session).filter(
    (g) => g.appId === game.appId && !done.has(g.instanceId),
  )) {
    byId.set(g.instanceId, fromCouch(g, byId.get(g.instanceId)));
  }
  return [...byId.values()].sort((a, b) => Number(b.live) - Number(a.live) || b.at - a.at);
}

function fromInstance(i: Instance): Sitting {
  return {
    instanceId: i.instanceId,
    // A Tier 0 visit's title is only the game's name.
    label: i.source === "visit" ? "" : i.title || i.detail,
    at: i.updatedAt,
    resumeUrl: i.resumeUrl,
    live: false,
  };
}

interface CouchSitting {
  appId: string;
  instanceId: string;
  label: string;
  at: number;
  live: boolean;
}

/** The couch session's live sitting (if any) and its paused ones. */
function couchSittings(session: SessionState | null): CouchSitting[] {
  const current = session?.current;
  const live = current ? [{ ...current, at: current.startedAt, live: true }] : [];
  return [...live, ...(session?.suspended ?? []).map((g) => ({ ...g, live: false }))];
}

/** A couch sitting, keeping what the instance knew that the couch doesn't. */
function fromCouch(g: CouchSitting, known: Sitting | undefined): Sitting {
  return {
    instanceId: g.instanceId,
    label: g.label || (known?.label ?? ""),
    at: Math.max(g.at, known?.at ?? 0),
    resumeUrl: known?.resumeUrl,
    live: g.live,
  };
}

const MIN = 60 * 1000;
const H = 60 * MIN;
const DAY = 24 * H;

/** "Just now", "5 min ago", "2 hours ago", "Yesterday", "3 days ago". */
export function playedAgo(at: number, now: number): string {
  const ago = now - at;
  if (ago < MIN) return "Just now";
  if (ago < H) return `${Math.floor(ago / MIN)} min ago`;
  if (ago < DAY) {
    const h = Math.floor(ago / H);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }
  if (ago < 2 * DAY) return "Yesterday";
  return `${Math.floor(ago / DAY)} days ago`;
}

/** A fresh sitting's id, shaped like the couch session's own (`<appId>-<time base 36>`). */
export const newSittingId = (appId: string, now: number): string => `${appId}-${now.toString(36)}`;

/**
 * The sitting a game screen opens: the one named (Rejoin), a fresh one when it opens the start
 * page, else unknown (a resume URL with no sitting attached).
 */
export function sittingToOpen(
  appId: string,
  opts: { instanceId?: string; resumeUrl?: string },
  now: number,
): string | undefined {
  if (opts.instanceId) return opts.instanceId;
  return opts.resumeUrl ? undefined : newSittingId(appId, now);
}
