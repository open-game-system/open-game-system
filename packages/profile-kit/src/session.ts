import { type GamePlayer, LauncherToGameSchema } from "@open-game-system/ogs-protocol";
import type { Source } from "./profile";

export type { GamePlayer };

/** What a game's TV page knows from the OGS launcher's ogs:start. */
export interface OgsSession {
  /** Who's on the couch: profile id, @id, name, avatar. */
  players: GamePlayer[];
  /** A game token for this game and session (verify it on the game server); "" when none. */
  token: string;
  /** The OGS sitting and whether it continues or starts new. */
  instanceId: string;
  mode: "continue" | "new";
  /** The room to join (another couch made it; multiCouch games). Absent: make your own. */
  room?: string;
}

/** undefined = waiting for the launcher · null = not on an OGS TV · the session. */
export type SessionSnapshot = OgsSession | null | undefined;

type MessageHandler = (ev: { data: unknown; source: unknown }) => void;

/** Something a page can post to (its parent window). */
export interface FrameTarget {
  postMessage(message: unknown, targetOrigin: string): void;
}

/** The bits of `window` the TV side needs (a fake in tests). */
export interface FrameWindow extends FrameTarget {
  parent: FrameTarget | null;
  addEventListener(type: "message", handler: MessageHandler): void;
  removeEventListener(type: "message", handler: MessageHandler): void;
}

export const SESSION_TIMEOUT_MS = 300;

/**
 * The couch session as an external store. Listens for the launcher's ogs:start from the moment it
 * is created (create it early: the launcher posts on the frame's load) and says ogs:ready so the
 * launcher re-sends a start the page missed.
 */
export function createSessionSource(opts: {
  win: FrameWindow;
  timeoutMs?: number;
}): Source<SessionSnapshot> {
  const { win } = opts;
  const parent = win.parent;
  const listeners = new Set<() => void>();
  if (!parent || parent === win) {
    return { getSnapshot: () => null, subscribe: () => () => {} };
  }
  let snapshot: SessionSnapshot;
  const set = (next: SessionSnapshot) => {
    snapshot = next;
    for (const l of listeners) l();
  };

  win.addEventListener("message", (ev) => {
    if (ev.source !== parent) return;
    const parsed = LauncherToGameSchema.safeParse(ev.data);
    if (!parsed.success || parsed.data.type !== "ogs:start") return;
    const { players, token, instanceId, mode, room } = parsed.data;
    set({ players: players ?? [], token, instanceId, mode, ...(room ? { room } : {}) });
  });
  parent.postMessage({ type: "ogs:ready" }, "*");
  setTimeout(() => {
    if (snapshot === undefined) set(null);
  }, opts.timeoutMs ?? SESSION_TIMEOUT_MS);

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
