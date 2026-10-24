import { z } from "zod";
import type { AirplayDisplay, DisplayInfo } from "./airplay-display";
import type { AirplaySheet } from "./airplay-sheet";
import type { CastBackend } from "./cast-backend";
import type { CastDevice } from "./cast-store";
import type { SessionManagerLike } from "./cast-sync";
import type { LogData, LogLevel } from "./client-log";

/**
 * An Apple TV or AirPlay TV as one more cast backend (ADR 2026-10-23-airplay-display): the phone
 * renders the TV page itself on the external display iOS gives the app when the user picks Control
 * Center > Screen Mirroring, so no cloud GPU is used. The cast flow is the Chromecast's: cast-sync
 * sends LOAD_VIEW with the view URL (the OGS TV launcher and its launcher token), and this backend
 * loads that URL in the phone's TV window, exactly as a browser TV runs the launcher. The launcher
 * then speaks the couch session and frames the game (ogs:start, ogs:suspend / ogs:resume, sitting
 * labels) as it does everywhere.
 */
export const AIRPLAY_DEVICE_ID = "airplay";
export const AIRPLAY_LABEL = "Apple TV / AirPlay";
/** How long one search looks for AirPlay receivers (AVRouteDetector costs power). */
export const ROUTE_SEARCH_SECONDS = 30;

type Session = NonNullable<Awaited<ReturnType<SessionManagerLike["getCurrentCastSession"]>>>;
type Handler<A extends unknown[]> = (...args: A) => void;
type Message = Record<string, unknown> | string;

const LoadViewSchema = z.object({ type: z.literal("LOAD_VIEW"), viewUrl: z.string().url() });

/** A LOAD_VIEW's view URL (object or JSON string), else null. */
function viewUrlOf(message: Message): string | null {
  let data: unknown = message;
  if (typeof message === "string") {
    try {
      data = JSON.parse(message);
    } catch {
      return null;
    }
  }
  const load = LoadViewSchema.safeParse(data);
  return load.success ? load.data.viewUrl : null;
}

/** The URL's host and path: its query carries the launcher token, which never goes in a log. */
function hostPath(url: string): string {
  const m = /^[a-z]+:\/\/([^?#]*)/i.exec(url);
  return m?.[1] ?? "";
}

export type AirplayLog = (name: string, data: LogData, level: LogLevel) => void;

export interface AirplayCastDeps {
  display: AirplayDisplay;
  sheet: AirplaySheet;
  /** The app's name on the TV's idle card and away notice (default: the bundle's name). */
  appName?: string;
  log?: AirplayLog;
  /** A local notification: "Open <app> to keep the TV going" (the TV shows the same notice). */
  notifyAway?: () => Promise<void>;
  appState?: {
    addEventListener(type: "change", listener: (state: string) => void): { remove(): void };
  };
}

export type AirplayCastBackend = CastBackend & { dispose(): void };

export function createAirplayCastBackend(deps: AirplayCastDeps): AirplayCastBackend {
  const { display, sheet } = deps;
  const log: AirplayLog = deps.log ?? (() => {});
  if (deps.appName) void display.setAppName(deps.appName).catch(() => {});
  let connected: DisplayInfo | null = null;
  let routes = false;
  let current: Session | null = null;
  let waiting: { promise: Promise<boolean>; resolve: (ok: boolean) => void } | null = null;
  let away = false;

  // One array per change: pickers read it with useSyncExternalStore.
  let devices: CastDevice[] = [];
  const deviceListeners = new Set<(d: CastDevice[]) => void>();
  const nameNow = () => (connected && connected.name !== "TV" ? connected.name : AIRPLAY_LABEL);
  const publish = () => {
    const offered = display.available && (connected !== null || routes);
    const next: CastDevice[] = offered
      ? [{ id: AIRPLAY_DEVICE_ID, name: nameNow(), type: "airplay" }]
      : [];
    if (next.length === devices.length && next[0]?.name === devices[0]?.name) return;
    devices = next;
    for (const l of deviceListeners) l(devices);
  };

  const handlers = {
    starting: new Set<Handler<[]>>(),
    started: new Set<Handler<[Session]>>(),
    startFailed: new Set<Handler<[Session, string]>>(),
    suspended: new Set<Handler<[]>>(),
    resumed: new Set<Handler<[Session]>>(),
    ending: new Set<Handler<[]>>(),
    ended: new Set<Handler<[]>>(),
  };
  const on = <A extends unknown[]>(set: Set<Handler<A>>, fn: Handler<A>) => {
    set.add(fn);
    return { remove: () => void set.delete(fn) };
  };
  const emit = <A extends unknown[]>(set: Set<Handler<A>>, ...args: A) => {
    for (const h of set) h(...args);
  };

  function makeSession(): Session {
    return {
      getCastDevice: async () => ({ deviceId: AIRPLAY_DEVICE_ID, friendlyName: nameNow() }),
      addChannel: async () => ({
        async sendMessage(message: Message) {
          const viewUrl = viewUrlOf(message);
          if (!viewUrl) return;
          log("airplay.view", { view: hostPath(viewUrl) }, "info");
          await display.start(viewUrl);
        },
        onMessage() {},
      }),
    };
  }

  const begin = () => {
    current = makeSession();
    away = false;
    emit(handlers.started, current);
  };

  const finishWait = (ok: boolean) => {
    const w = waiting;
    waiting = null;
    w?.resolve(ok);
  };

  const subs = [
    display.onConnect((info) => {
      connected = info;
      publish();
      log("airplay.connected", { ...info, waiting: waiting !== null }, "info");
      if (waiting) {
        sheet.done();
        begin();
        finishWait(true);
      }
    }),
    display.onDisconnect(() => {
      const casting = current !== null;
      connected = null;
      publish();
      log("airplay.disconnected", { casting }, "info");
      if (!current) return;
      current = null;
      void display.stop();
      emit(handlers.ended);
    }),
    display.onAudioOnlyAirPlay((name) => {
      if (!waiting) return;
      log("airplay.audio_only", { name }, "warn");
      sheet.open("audio-only");
    }),
    display.onRoutes((available) => {
      routes = available;
      publish();
    }),
  ];
  const offClose = sheet.onClose((mode) => {
    log("airplay.sheet_close", { mode, connected: connected !== null }, "info");
    if (!waiting) return;
    emit(handlers.ended);
    finishWait(false);
  });
  const appSub = deps.appState?.addEventListener("change", (state) => {
    if (state === "active") {
      away = false;
      return;
    }
    if (state !== "background" || !current || away) return;
    away = true;
    log("airplay.away", { state }, "info");
    deps
      .notifyAway?.()
      .catch((err: unknown) =>
        log(
          "airplay.away_failed",
          { error: err instanceof Error ? err.message : String(err) },
          "warn",
        ),
      );
  });

  const ready = display
    .currentDisplay()
    .catch(() => null)
    .then((info) => {
      // A connect event that came in meanwhile wins.
      if (info && !connected) connected = info;
      publish();
    });

  const sessionManager: SessionManagerLike = {
    getCurrentCastSession: async () => current,
    async startSession(deviceId: string) {
      if (deviceId !== AIRPLAY_DEVICE_ID || !display.available) return false;
      await ready;
      if (current) return true;
      if (waiting) return waiting.promise;
      emit(handlers.starting);
      log("airplay.start", { connected: connected !== null }, "info");
      if (connected) {
        begin();
        return true;
      }
      let resolve: (ok: boolean) => void = () => {};
      const promise = new Promise<boolean>((r) => {
        resolve = r;
      });
      waiting = { promise, resolve };
      sheet.open("steps");
      log("airplay.sheet_open", { mode: "steps" }, "info");
      return promise;
    },
    async endCurrentSession() {
      if (!current) return;
      emit(handlers.ending);
      current = null;
      try {
        await display.stop();
      } finally {
        emit(handlers.ended);
      }
    },
    onSessionStarting: (fn) => on(handlers.starting, fn),
    onSessionStarted: (fn) => on(handlers.started, fn),
    onSessionStartFailed: (fn) => on(handlers.startFailed, fn),
    onSessionSuspended: (fn) => on(handlers.suspended, fn),
    onSessionResumed: (fn) => on(handlers.resumed, fn),
    onSessionEnding: (fn) => on(handlers.ending, fn),
    onSessionEnded: (fn) => on(handlers.ended, fn),
  };

  return {
    sessionManager,
    startDiscovery() {
      if (!display.available) return;
      void display
        .detectRoutes(ROUTE_SEARCH_SECONDS)
        .then((available) => {
          routes = routes || available;
          publish();
        })
        .catch(() => {});
    },
    getDevices: () => devices,
    subscribeDevices(listener) {
      deviceListeners.add(listener);
      return () => {
        deviceListeners.delete(listener);
      };
    },
    showCastDialog() {},
    dispose() {
      for (const s of subs) s.remove();
      offClose();
      appSub?.remove();
    },
  };
}
