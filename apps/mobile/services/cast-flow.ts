import type { Store } from "@open-game-system/app-bridge-types";
import type { ClientMessage } from "@open-game-system/ogs-protocol";
import type { StopResult } from "./cast-stop";
import type { NativeCastEvents, NativeCastState } from "./cast-store";
import type { SessionManagerLike } from "./cast-sync";
import { type CastTrace, noTrace } from "./cast-trace";
import { hashId } from "./client-log";
import { type AppConfig, launcherUrl } from "./config";
import { routeGameCastEvent } from "./game-cast-route";

type CastStore = Store<NativeCastState, NativeCastEvents>;

/**
 * TV tab → Cast: get a launcher token, point the receiver's view at the launcher, start the
 * session. cast-sync then sends LOAD_VIEW once when the session connects; nothing a game does
 * later sends another.
 */
type CastInput = {
  api: { launcherToken(): Promise<string> };
  config: AppConfig;
  castStore: CastStore;
  backend: { sessionManager: SessionManagerLike };
  deviceId: string;
  trace?: CastTrace;
};

export async function castToTv(input: CastInput): Promise<"started" | "no-tv"> {
  const trace = input.trace ?? noTrace;
  trace.begin("cast", { tv: hashId(input.deviceId) });
  return startOn(input, trace);
}

/** Launcher token → view → startSession, logged. A refused or failed start is "no-tv". */
async function startOn(input: CastInput, trace: CastTrace): Promise<"started" | "no-tv"> {
  const token = await input.api.launcherToken();
  input.castStore.dispatch({ type: "SET_VIEW_URL", url: launcherUrl(input.config, token) });
  const t0 = trace.now();
  const data = { tv: hashId(input.deviceId) };
  trace.event("start.requested", { data });
  const ok = await input.backend.sessionManager.startSession(input.deviceId).then(
    (started) => {
      trace.event("start.resolved", {
        level: started ? "info" : "warn",
        durationMs: trace.now() - t0,
        data: { ...data, started },
      });
      return started;
    },
    (err: unknown) => {
      trace.event("start.rejected", { error: err, durationMs: trace.now() - t0, data });
      return false;
    },
  );
  return ok ? "started" : "no-tv";
}

/** How long a switch waits for the old TV's session to end before starting the new one. */
export const END_WAIT_MS = 8000;

/**
 * Ends the current session and resolves once it has ended. Google Cast ends a session
 * asynchronously: the native endCurrentSession resolves as soon as the end is asked for, the
 * session stays current until didEndCastSession, and until then startSessionWithDevice: answers
 * NO. "none": there was no session (end is still asked for, harmlessly). "timeout": no ended
 * event within `timeoutMs`.
 */
export async function endSessionAndWait(
  sm: SessionManagerLike,
  opts: { timeoutMs?: number; trace?: CastTrace } = {},
): Promise<"ended" | "none" | "timeout"> {
  const trace = opts.trace ?? noTrace;
  const current = await sm.getCurrentCastSession().catch(() => null);
  const t0 = trace.now();
  trace.event("end.requested", { data: { hadSession: current !== null } });
  if (!current) {
    await requestEnd(sm, trace, t0);
    return "none";
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: "ended" | "timeout") => {
      if (settled) return;
      settled = true;
      sub.remove();
      clearTimeout(timer);
      trace.event("end.waited", {
        level: outcome === "ended" ? "info" : "warn",
        durationMs: trace.now() - t0,
        data: { outcome },
      });
      resolve(outcome);
    };
    // Subscribed before asking: a session that ends at once still counts.
    const sub = sm.onSessionEnded(() => finish("ended"));
    const timer = setTimeout(() => finish("timeout"), opts.timeoutMs ?? END_WAIT_MS);
    void requestEnd(sm, trace, t0);
  });
}

/** endCurrentSession(true), logged; a rejection is logged and otherwise ignored, as before. */
function requestEnd(sm: SessionManagerLike, trace: CastTrace, t0: number) {
  return sm.endCurrentSession(true).then(
    () => trace.event("end.resolved", { durationMs: trace.now() - t0 }),
    (err: unknown) => trace.event("end.rejected", { error: err, durationMs: trace.now() - t0 }),
  );
}

/**
 * Remote → TV picker: move the cast to another TV. Stops the cast on the old TV (without
 * ending the couch session, so the current game keeps its place), waits until that session has
 * really ended (Google Cast refuses a new start until then: the "sometimes it doesn't work" of
 * 2026-10-05), then casts the launcher to the new one. Picking the TV you're already on does
 * nothing.
 */
export async function switchTv(
  input: CastInput & { endWaitMs?: number },
): Promise<"started" | "no-tv" | "same"> {
  const { session } = input.castStore.getSnapshot();
  if (session.status === "connected" && session.deviceId === input.deviceId) return "same";
  const trace = input.trace ?? noTrace;
  const t0 = trace.now();
  trace.begin("switch", {
    from: session.deviceId ? hashId(session.deviceId) : null,
    to: hashId(input.deviceId),
  });
  await endSessionAndWait(input.backend.sessionManager, { timeoutMs: input.endWaitMs, trace });
  const result = await startOn(input, trace);
  trace.event("switch.done", {
    level: result === "started" ? "info" : "error",
    durationMs: trace.now() - t0,
    data: { result },
  });
  return result;
}

/** Remote → Stop casting (was "End for tonight"): the session suspends the game and goes home, then the cast stops. */
export async function endForTonight(input: {
  send: (msg: ClientMessage) => void;
  sessionManager: SessionManagerLike;
  trace?: CastTrace;
}): Promise<StopResult> {
  const trace = input.trace ?? noTrace;
  trace.begin("stop");
  const t0 = trace.now();
  input.send({ type: "end" });
  return input.sessionManager.endCurrentSession(true).then(
    (): StopResult => {
      trace.event("end.resolved", { durationMs: trace.now() - t0 });
      return "stopped";
    },
    (err: unknown): StopResult => {
      trace.event("end.rejected", { error: err, durationMs: trace.now() - t0 });
      return "failed";
    },
  );
}

/**
 * The "cast" store a game page sees over app-bridge: the app's cast state, with the game's events
 * routed by routeGameCastEvent (game.view to the session while cast through OGS).
 */
export function createGameCastStore(
  castStore: CastStore,
  context: () => { ogsCast: boolean; appId: string | null },
  send: (msg: ClientMessage) => void,
): CastStore {
  return {
    getSnapshot: () => castStore.getSnapshot(),
    subscribe: (listener) => castStore.subscribe(listener),
    reset: () => castStore.reset(),
    on: (type, listener) => castStore.on(type, listener),
    dispatch(event) {
      const route = routeGameCastEvent(event, context());
      if (route.to === "session") send(route.msg);
      else if (route.to === "store") castStore.dispatch(event);
    },
  };
}
