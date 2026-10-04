import {
  type ClientMessage,
  type CurrentGame,
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
  const { active, parked } = prev;
  if (!current) {
    if (!active) return { frames: prev, posts: [] };
    return { frames: { active: null, parked: active }, posts: [suspend(active)] };
  }
  if (active?.instanceId === current.instanceId) {
    if (!current.viewUrl || current.viewUrl === active.url) return { frames: prev, posts: [] };
    return { frames: { active: { ...active, url: current.viewUrl }, parked }, posts: [] };
  }
  const posts: FramePost[] = active ? [suspend(active)] : [];
  const nextParked = active ?? parked;
  if (parked?.instanceId === current.instanceId) {
    const url = current.viewUrl ?? parked.url;
    return {
      frames: { active: { ...parked, url }, parked: active },
      posts: [...posts, { instanceId: parked.instanceId, msg: { type: "ogs:resume" } }],
    };
  }
  const fresh = current.viewUrl
    ? { appId: current.appId, instanceId: current.instanceId, url: current.viewUrl }
    : null;
  // Waiting for the game's TV view with nothing to change: keep the same object, or the caller's
  // effect sees "new frames" on every render and loops.
  if (!fresh && !active && nextParked === parked) return { frames: prev, posts };
  return { frames: { active: fresh, parked: nextParked }, posts };
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

/**
 * Sent to the frame on load. The launcher's own token authenticates the couch socket and must not
 * reach a game's origin, so `token` stays empty until the session hands out a game-scoped one.
 */
export function startMessage(current: CurrentGame): LauncherToGame {
  return {
    type: "ogs:start",
    instanceId: current.instanceId,
    mode: current.mode,
    roster: current.roster,
    token: "",
  };
}
