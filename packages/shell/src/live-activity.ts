import type {
  LiveActivityAttributes,
  LiveActivityContent,
  LiveActivityStatus,
} from "@open-game-system/ogs-protocol";
import { backgroundTimeout } from "./background-timer";
import type { LiveActivityNative } from "./live-activity-native";

/** At most one update per 5 s; a burst sends its last status when the window ends. */
export const LIVE_ACTIVITY_THROTTLE_MS = 5_000;
/** No report and no join for 30 min: the game is over for this phone. */
export const LIVE_ACTIVITY_IDLE_MS = 30 * 60_000;
/** Stale (and ended) 4 h after it started, however busy. */
export const LIVE_ACTIVITY_STALE_MS = 4 * 60 * 60_000;
/** How long an ended activity stays on the lock screen. */
export const LIVE_ACTIVITY_ENDED_SHOWN_MS = 2 * 60_000;

export const PLAYING_ON_TV: LiveActivityStatus = {
  phase: "playing",
  status: "Playing on the TV",
  yourTurn: false,
};
export const GAME_OVER: LiveActivityStatus = {
  phase: "ended",
  status: "Game over",
  yourTurn: false,
};

export interface LiveActivityDeps {
  native: LiveActivityNative | null;
  now: () => number;
  /** The running activity's push token (remote updates): the app registers it with OGS. */
  onPushToken?: (token: { activityId: string; pushToken: string }) => void;
}

interface Run {
  appId: string;
  /** null while ActivityKit is starting it. */
  id: string | null;
  startedAt: number;
  sent: LiveActivityStatus;
  sentAt: number;
  pending: LiveActivityStatus | null;
  throttle: ReturnType<typeof setTimeout> | null;
  idle: ReturnType<typeof setTimeout> | null;
  stale: ReturnType<typeof setTimeout> | null;
}

const same = (a: LiveActivityStatus, b: LiveActivityStatus) =>
  a.phase === b.phase && a.status === b.status && a.yourTurn === b.yourTurn;

const warn = (what: string) => (err: unknown) =>
  console.warn(`[ogs-shell] Live Activity ${what} failed:`, err);

/**
 * The controller phone's Live Activity (docs/acceptance/2026-10-21-live-activities.feature): one at a
 * time, started when the phone joins a game, updated with meaningful status changes (throttled),
 * ended when the session ends, after 30 min idle or 4 h in. A no-op without the native module or
 * when the user disallowed Live Activities: the controller never depends on it.
 */
export function createLiveActivity(deps: LiveActivityDeps) {
  const { native, now } = deps;
  let run: Run | null = null;
  /** Tokens that came before their start resolved (ActivityKit may be quicker than the bridge). */
  const early = new Map<string, string>();

  const clearTimers = (r: Run) => {
    for (const t of [r.throttle, r.idle, r.stale]) if (t) clearTimeout(t);
    r.throttle = null;
    r.idle = null;
    r.stale = null;
  };

  const content = (status: LiveActivityStatus): LiveActivityContent => ({
    ...status,
    updatedAt: now(),
  });

  function finish(r: Run, status: LiveActivityStatus) {
    clearTimers(r);
    if (run === r) run = null;
    if (r.id && native)
      native.end(r.id, content(status), now() + LIVE_ACTIVITY_ENDED_SHOWN_MS).catch(warn("end"));
  }

  function touch(r: Run) {
    if (r.idle) clearTimeout(r.idle);
    r.idle = backgroundTimeout(() => finish(r, GAME_OVER), LIVE_ACTIVITY_IDLE_MS);
  }

  function send(r: Run) {
    r.throttle = null;
    const next = r.pending;
    if (!next || !r.id || !native) return;
    r.pending = null;
    r.sent = next;
    r.sentAt = now();
    native.update(r.id, content(next), r.startedAt + LIVE_ACTIVITY_STALE_MS).catch(warn("update"));
  }

  function schedule(r: Run) {
    if (!r.id || r.throttle || !r.pending) return;
    const wait = r.sentAt + LIVE_ACTIVITY_THROTTLE_MS - now();
    if (wait <= 0) send(r);
    else r.throttle = backgroundTimeout(() => send(r), wait);
  }

  function forward(activityId: string, pushToken: string) {
    deps.onPushToken?.({ activityId, pushToken });
  }

  function started(r: Run, id: string) {
    r.id = id;
    if (run !== r) {
      // Ended (or replaced) while ActivityKit was starting it.
      native?.end(id, content(GAME_OVER), now()).catch(warn("end"));
      return;
    }
    const token = early.get(id);
    early.clear();
    if (token) forward(id, token);
    schedule(r);
  }

  const unsubscribe = native
    ? [
        native.onPushToken(({ activityId, token }) => {
          if (run?.id === activityId) forward(activityId, token);
          else if (run && !run.id) early.set(activityId, token);
        }),
        native.onStateChange(({ activityId, state }) => {
          if (run?.id !== activityId || (state !== "ended" && state !== "dismissed")) return;
          // The user swiped it away (or iOS ended it): forget it, never update it again.
          clearTimers(run);
          run = null;
        }),
      ]
    : [];

  return {
    /** The phone is the controller for this game: start its activity (once per game). */
    join(attributes: LiveActivityAttributes, status: LiveActivityStatus = PLAYING_ON_TV): void {
      if (!native || !native.isEnabled()) return;
      if (run?.appId === attributes.appId) {
        touch(run);
        return;
      }
      if (run) finish(run, GAME_OVER);
      const startedAt = now();
      const r: Run = {
        appId: attributes.appId,
        id: null,
        startedAt,
        sent: status,
        sentAt: startedAt,
        pending: null,
        throttle: null,
        idle: null,
        stale: backgroundTimeout(() => finish(r, GAME_OVER), LIVE_ACTIVITY_STALE_MS),
      };
      run = r;
      touch(r);
      native
        .start(attributes, content(status), startedAt + LIVE_ACTIVITY_STALE_MS)
        .then((id) => started(r, id))
        .catch((err: unknown) => {
          clearTimers(r);
          if (run === r) run = null;
          warn("start")(err);
        });
    },
    /** The game's status (its INSTANCE_REPORT, or the couch session): update if it changed. */
    report(status: LiveActivityStatus): void {
      const r = run;
      if (!r) return;
      touch(r);
      if (status.phase === "ended") {
        finish(r, status);
        return;
      }
      if (same(r.pending ?? r.sent, status)) return;
      r.pending = status;
      schedule(r);
    },
    /** The session ended. */
    end(): void {
      if (run) finish(run, GAME_OVER);
    },
    current: (): { id: string; appId: string } | null =>
      run?.id ? { id: run.id, appId: run.appId } : null,
    dispose(): void {
      for (const off of unsubscribe) off();
      if (run) clearTimers(run);
      run = null;
    },
  };
}

export type LiveActivity = ReturnType<typeof createLiveActivity>;
