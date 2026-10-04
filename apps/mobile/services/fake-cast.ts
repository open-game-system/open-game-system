import type { CastBackend } from "./cast-backend";
import type { CastDevice } from "./cast-store";
import type { SessionManagerLike } from "./cast-sync";

/**
 * A Google Cast stand-in for the iOS simulator (EXPO_PUBLIC_FAKE_CAST). It sits behind the same
 * interfaces as the real one (SessionManagerLike, ViewChannelSession), so cast-sync, the TV tab
 * and the game screen run unchanged. The "receiver" is the fake Chromecast the main loop runs:
 * LOAD_VIEW becomes POST { viewUrl } to its control URL, where a browser opens the launcher;
 * ending the session becomes POST /stop on the same origin, which closes it.
 */

export const FAKE_TV: CastDevice = {
  id: "fake-living-room",
  name: "Living room TV",
  type: "chromecast",
};

/** A second TV (EXPO_PUBLIC_FAKE_CAST=2), found a moment after the first, as real discovery does. */
export const FAKE_TV_2: CastDevice = {
  id: "fake-bedroom",
  name: "Bedroom TV",
  type: "chromecast",
};
export const FAKE_TV_2_DELAY_MS = 1500;

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type Message = Record<string, unknown> | string;
type Handler<A extends unknown[]> = (...args: A) => void;

export function createFakeCastBackend(opts: {
  mode: "one" | "two" | "none";
  loadUrl: string;
  fetch: FetchLike;
}): CastBackend {
  const devices =
    opts.mode === "none" ? [] : opts.mode === "two" ? [FAKE_TV, FAKE_TV_2] : [FAKE_TV];
  let discovered: CastDevice[] = [];
  let trickle: ReturnType<typeof setTimeout> | null = null;
  const deviceListeners = new Set<(d: CastDevice[]) => void>();

  type Session = ReturnType<typeof makeSession>;
  let current: Session | null = null;
  const handlers = {
    starting: new Set<Handler<[]>>(),
    started: new Set<Handler<[Session]>>(),
    startFailed: new Set<Handler<[Session, string]>>(),
    suspended: new Set<Handler<[]>>(),
    resumed: new Set<Handler<[Session]>>(),
    ended: new Set<Handler<[]>>(),
  };
  const on = <A extends unknown[]>(set: Set<Handler<A>>, fn: Handler<A>) => {
    set.add(fn);
    return { remove: () => void set.delete(fn) };
  };

  function makeSession(device: CastDevice) {
    return {
      getCastDevice: async () => ({ deviceId: device.id, friendlyName: device.name }),
      addChannel: async (_namespace: string) => ({
        async sendMessage(message: Message) {
          const data = typeof message === "string" ? JSON.parse(message) : message;
          if (data?.type !== "LOAD_VIEW") return;
          try {
            await opts.fetch(opts.loadUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ viewUrl: data.viewUrl }),
            });
          } catch (err) {
            console.warn("[fake-cast] the fake Chromecast did not take the view:", err);
          }
        },
        onMessage(_listener: (message: Message) => void) {},
      }),
    };
  }

  const sessionManager: SessionManagerLike = {
    getCurrentCastSession: async () => current,
    async startSession(deviceId: string) {
      const device = devices.find((d) => d.id === deviceId);
      if (!device) return false;
      for (const h of handlers.starting) h();
      const session = makeSession(device);
      current = session;
      for (const h of handlers.started) h(session);
      return true;
    },
    async endCurrentSession() {
      if (!current) return;
      current = null;
      // A real receiver closes when the sender stops casting: the fake Chromecast closes its TV page.
      try {
        await opts.fetch(new URL("/stop", opts.loadUrl).href, { method: "POST" });
      } catch (err) {
        console.warn("[fake-cast] the fake Chromecast did not stop:", err);
      }
      for (const h of handlers.ended) h();
    },
    onSessionStarting: (fn) => on(handlers.starting, fn),
    onSessionStarted: (fn) => on(handlers.started, fn),
    onSessionStartFailed: (fn) => on(handlers.startFailed, fn),
    onSessionSuspended: (fn) => on(handlers.suspended, fn),
    onSessionResumed: (fn) => on(handlers.resumed, fn),
    onSessionEnded: (fn) => on(handlers.ended, fn),
  };

  return {
    sessionManager,
    startDiscovery() {
      const publish = (found: CastDevice[]) => {
        discovered = found;
        for (const l of deviceListeners) l(discovered);
      };
      if (trickle) clearTimeout(trickle);
      trickle = null;
      if (devices.length < 2 || discovered.length === devices.length) return publish(devices);
      publish(devices.slice(0, 1));
      trickle = setTimeout(() => {
        trickle = null;
        publish(devices);
      }, FAKE_TV_2_DELAY_MS);
    },
    getDevices: () => discovered,
    subscribeDevices(listener) {
      deviceListeners.add(listener);
      return () => {
        deviceListeners.delete(listener);
      };
    },
    showCastDialog() {
      // The simulator has no native picker; the TV tab lists the fake device itself.
    },
  };
}
