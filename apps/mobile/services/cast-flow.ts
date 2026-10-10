import type { Store } from "@open-game-system/app-bridge-types";
import type { ClientMessage } from "@open-game-system/ogs-protocol";
import type { StopResult } from "./cast-stop";
import type { CastSession, NativeCastEvents, NativeCastState } from "./cast-store";
import { SWITCH_TIMEOUT_MS } from "./cast-switch";
import type { SessionManagerLike } from "./cast-sync";
import { type CastTrace, noTrace } from "./cast-trace";
import { hashId, type LogData } from "./client-log";
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

/**
 * What became of a Cast. "no-tv": Cast refused or failed the start with no session up (the TV
 * can't be reached). "timeout": a session on its way to this TV never connected.
 * "refused-session-active": Cast refused the start because a session it knows of is up on
 * another TV (one this phone hadn't heard of).
 */
export type CastOutcome = "started" | "no-tv" | "timeout" | "refused-session-active";

/**
 * How long a Cast waits for a session already on its way to its TV (connecting, resuming) to
 * connect: as long as a switch waits for the new TV.
 */
export const CONNECT_WAIT_MS = SWITCH_TIMEOUT_MS;

type CastOptions = CastInput & {
  /** How long to wait for a session on its way to this TV (default CONNECT_WAIT_MS). */
  connectWaitMs?: number;
  /** How long to wait for another TV's session to end (default END_WAIT_MS). */
  endWaitMs?: number;
  /** More context for the attempt's cast.cast.requested (e.g. the prompt that asked). */
  logData?: LogData;
};

/** The session as this phone sees it: the cast store, else Google Cast's own current session. */
type SessionNow = {
  status: CastSession["status"];
  /** The TV of the store's session, else of the SDK's. */
  deviceId: string | null;
  /** The SDK has a current session (asked only when the store names no TV). */
  sdkSession: boolean;
};

/** What a Cast does about the session: start one, use the one up, wait for it, or switch. */
type Plan = "start" | "already-connected" | "connecting" | "switch";

function planFor(now: SessionNow, target: string): Plan {
  if (!now.deviceId) return "start";
  if (now.deviceId !== target) return "switch";
  return now.status === "connected" ? "already-connected" : "connecting";
}

/** Google Cast's current session and its TV, if it has one. */
async function sdkSessionTv(sm: SessionManagerLike): Promise<{ deviceId: string | null } | null> {
  const session = await sm.getCurrentCastSession().catch(() => null);
  if (!session) return null;
  const device = await session.getCastDevice().catch(() => null);
  return { deviceId: device?.deviceId ?? null };
}

async function sessionNow(input: CastInput): Promise<SessionNow> {
  const { session } = input.castStore.getSnapshot();
  if (session.status !== "disconnected" && session.deviceId)
    return { status: session.status, deviceId: session.deviceId, sdkSession: false };
  // The store can lag Google Cast (a session resuming after a relaunch, one coming up): ask it.
  const sdk = await sdkSessionTv(input.backend.sessionManager);
  return { status: session.status, deviceId: sdk?.deviceId ?? null, sdkSession: sdk !== null };
}

/**
 * Cast the launcher to a TV, minding the session already there. Google Cast's startSession
 * answers NO "if there is a session currently established" (docs/lessons.md), so a Cast while a
 * session was up or coming up was refused and shown as "didn't answer" (owner, 2026-10-10). The
 * same TV connected: the new launcher goes to it, no start. The same TV connecting: wait for it.
 * Another TV: end that session and wait for the end, then start (as a switch does).
 */
export async function castToTv(input: CastOptions): Promise<CastOutcome> {
  const trace = input.trace ?? noTrace;
  const tv = hashId(input.deviceId);
  trace.begin("cast", { tv, ...input.logData });
  const now = await sessionNow(input);
  const plan = planFor(now, input.deviceId);
  trace.event("start.requested", {
    data: {
      tv,
      targetTv: tv,
      sessionStatus: now.status,
      sdkSession: now.sdkSession,
      currentTv: now.deviceId ? hashId(now.deviceId) : null,
      plan,
    },
  });
  switch (plan) {
    case "already-connected":
      await showLauncher(input);
      trace.event("start.skipped", { data: { tv, reason: plan } });
      return "started";
    case "connecting":
      await showLauncher(input);
      trace.event("start.skipped", { data: { tv, reason: plan } });
      return waitConnected(input, trace);
    case "switch":
      await endSessionAndWait(input.backend.sessionManager, { timeoutMs: input.endWaitMs, trace });
      return startAndCheck(input, trace);
    case "start":
      return startAndCheck(input, trace);
  }
}

/** A start; when Cast refuses it, why (a session is up, or none is) and what that means. */
async function startAndCheck(input: CastOptions, trace: CastTrace): Promise<CastOutcome> {
  await showLauncher(input);
  const tv = hashId(input.deviceId);
  const sm = input.backend.sessionManager;
  const t0 = trace.now();
  const started = await sm.startSession(input.deviceId).then(
    (ok): boolean | "rejected" => ok,
    (err: unknown): "rejected" => {
      trace.event("start.rejected", { error: err, durationMs: trace.now() - t0, data: { tv } });
      return "rejected";
    },
  );
  if (started === "rejected") return "no-tv";
  if (started) {
    trace.event("start.resolved", {
      level: "info",
      durationMs: trace.now() - t0,
      data: { tv, started: true },
    });
    return "started";
  }
  const sdk = await sdkSessionTv(sm);
  trace.event("start.resolved", {
    level: "warn",
    durationMs: trace.now() - t0,
    data: {
      tv,
      started: false,
      reason: sdk ? "refused-session-active" : "refused-no-session",
      currentTv: sdk?.deviceId ? hashId(sdk.deviceId) : null,
    },
  });
  if (!sdk) return "no-tv";
  // The session that was up is this TV's (it came up meanwhile): wait for it.
  if (sdk.deviceId === input.deviceId) return waitConnected(input, trace);
  return "refused-session-active";
}

/** A new launcher token, and the receiver's view pointed at it (cast-sync sends LOAD_VIEW). */
async function showLauncher(input: CastInput): Promise<void> {
  const token = await input.api.launcherToken();
  input.castStore.dispatch({ type: "SET_VIEW_URL", url: launcherUrl(input.config, token) });
}

/** Waits until the store says this TV is connected, its start failed, or the wait is over. */
async function waitConnected(input: CastOptions, trace: CastTrace): Promise<CastOutcome> {
  const t0 = trace.now();
  const outcome = await new Promise<"connected" | "failed" | "timeout">((resolve) => {
    let settled = false;
    let off: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const done = (v: "connected" | "failed" | "timeout") => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      off?.();
      resolve(v);
    };
    // The store calls a new listener at once with the current state (see cast-switch.ts).
    off = input.castStore.subscribe(({ session, error }) => {
      if (session.status === "connected" && session.deviceId === input.deviceId) done("connected");
      else if (session.status === "disconnected" && error) done("failed");
    });
    if (settled) return off();
    timer = setTimeout(() => done("timeout"), input.connectWaitMs ?? CONNECT_WAIT_MS);
  });
  trace.event("connect.waited", {
    level: outcome === "connected" ? "info" : "warn",
    durationMs: trace.now() - t0,
    data: { tv: hashId(input.deviceId), outcome },
  });
  if (outcome === "connected") return "started";
  return outcome === "timeout" ? "timeout" : "no-tv";
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
