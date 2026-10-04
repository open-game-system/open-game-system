import {
  type ClientMessage,
  type CurrentGame,
  type GamePlayer,
  type GameToLauncher,
  GameToLauncherSchema,
  type LauncherToGame,
} from "@open-game-system/ogs-protocol";

/** A framed game page. The launcher keeps the active one and the last one it paused. */
export interface FrameSlot {
  appId: string;
  instanceId: string;
  url: string;
}
export interface Frames {
  active: FrameSlot | null;
  parked: FrameSlot | null;
}
export interface FramePost {
  instanceId: string;
  msg: LauncherToGame;
}

export const EMPTY_FRAMES: Frames = { active: null, parked: null };

const suspend = (slot: FrameSlot): FramePost => ({
  instanceId: slot.instanceId,
  msg: { type: "ogs:suspend" },
});

/**
 * How the frames follow the session's current game. Home and swaps park the old frame (and tell it
 * to suspend); Continue of the parked sitting brings that same frame back without a reload.
 */
export function nextFrames(
  prev: Frames,
  current: CurrentGame | null,
): { frames: Frames; posts: FramePost[] } {
  if (!current) return parkActive(prev);
  if (prev.active?.instanceId === current.instanceId)
    return sameSitting(prev, prev.active, current);
  return swapTo(prev, current);
}

type Next = { frames: Frames; posts: FramePost[] };

/** Home: the active frame (if any) is parked and suspended. */
function parkActive(prev: Frames): Next {
  if (!prev.active) return { frames: prev, posts: [] };
  return { frames: { active: null, parked: prev.active }, posts: [suspend(prev.active)] };
}

/** The same sitting: only a new TV view URL changes anything. */
function sameSitting(prev: Frames, active: FrameSlot, current: CurrentGame): Next {
  if (!current.viewUrl || current.viewUrl === active.url) return { frames: prev, posts: [] };
  return {
    frames: { active: { ...active, url: current.viewUrl }, parked: prev.parked },
    posts: [],
  };
}

/** Another sitting: suspend the active frame, then bring back the parked one or open a new one. */
function swapTo(prev: Frames, current: CurrentGame): Next {
  const posts: FramePost[] = prev.active ? [suspend(prev.active)] : [];
  return prev.parked?.instanceId === current.instanceId
    ? resumeParked(prev.parked, prev.active, current, posts)
    : openFresh(prev, current, posts);
}

/** Continue of the parked sitting: the same frame comes back (no reload) and is told to resume. */
function resumeParked(
  parked: FrameSlot,
  active: FrameSlot | null,
  current: CurrentGame,
  posts: FramePost[],
): Next {
  return {
    frames: { active: { ...parked, url: current.viewUrl ?? parked.url }, parked: active },
    posts: [...posts, { instanceId: parked.instanceId, msg: { type: "ogs:resume" } }],
  };
}

/** A new frame for the sitting once its TV view URL is known; the old active one is parked. */
function openFresh(prev: Frames, current: CurrentGame, posts: FramePost[]): Next {
  const { active, parked } = prev;
  const fresh = current.viewUrl
    ? { appId: current.appId, instanceId: current.instanceId, url: current.viewUrl }
    : null;
  // Waiting for the game's TV view with nothing to change: keep the same object, or the caller's
  // effect sees "new frames" on every render and loops.
  if (!fresh && !active) return { frames: prev, posts };
  return { frames: { active: fresh, parked: active ?? parked }, posts };
}

const originOf = (url: string | null): string | null => {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

/** A postMessage from the framed game, only if it came from the game's own origin. */
export function readFrameMessage(
  ev: { data: unknown; origin: string },
  viewUrl: string | null,
): GameToLauncher | null {
  const origin = originOf(viewUrl);
  if (!origin || ev.origin !== origin) return null;
  const r = GameToLauncherSchema.safeParse(ev.data);
  return r.success ? r.data : null;
}

export function toSessionMessages(msg: GameToLauncher, appId: string): ClientMessage[] {
  if (msg.type === "ogs:resume-point")
    return [{ type: "game.resume-point", appId, label: msg.label }];
  if (msg.type === "ogs:instance" && msg.report.title)
    return [{ type: "game.resume-point", appId, label: msg.report.title }];
  return [];
}

/** What the session hands a framed game: a game token for it (aud = appId, sid) and the couch. */
export interface StartGrant {
  token: string;
  players: GamePlayer[];
}

/**
 * Sent to the frame on load (and again when it says ogs:ready). The launcher's own token
 * authenticates the couch socket and never reaches a game's origin: the game gets a game-scoped
 * token from POST /sessions/:sid/game-token. `null` = no grant (OGS couldn't sign one): the game
 * starts with no token and nobody named; no second argument keeps the bare start.
 */
export function startMessage(current: CurrentGame, grant?: StartGrant | null): LauncherToGame {
  const start: LauncherToGame = {
    type: "ogs:start",
    instanceId: current.instanceId,
    mode: current.mode,
    roster: current.roster,
    token: grant?.token ?? "",
  };
  return grant === undefined ? start : { ...start, players: grant?.players ?? [] };
}

/** A frame said ogs:ready (it started listening late): re-send its start if it is the current sitting. */
export function restartFor(
  msg: GameToLauncher,
  slot: FrameSlot,
  current: CurrentGame | null,
): boolean {
  return msg.type === "ogs:ready" && current?.instanceId === slot.instanceId;
}
