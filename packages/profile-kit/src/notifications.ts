import {
  type NotificationsBridgeEvent,
  type NotificationsBridgeState,
  NotificationsBridgeStateSchema,
  type OgsNotification,
  type PushConsentResult,
  ServiceWorkerNotificationMessageSchema,
} from "@open-game-system/ogs-protocol";

export type { OgsNotification, PushConsentResult };

/** The app's `notifications` bridge store for a game's WebView (spec §9). */
export type NotificationsStores = {
  notifications: { state: NotificationsBridgeState; events: NotificationsBridgeEvent };
};

/** What notifications need of an app bridge (app-bridge-web's createWebBridge, or a mock). */
export interface NotificationsBridge {
  isSupported(): boolean;
  getStore(key: "notifications"):
    | {
        getSnapshot(): unknown;
        subscribe(listener: (state: unknown) => void): () => void;
        dispatch(event: NotificationsBridgeEvent): void;
      }
    | undefined;
  subscribe(listener: () => void): () => void;
}

type Port = { postMessage(message: unknown): void };
type WorkerMessage = { data: unknown; ports: readonly Port[] };

/** The parts of `navigator.serviceWorker` the PWA side uses (a fake in tests). */
export interface ServiceWorkerLike {
  addEventListener(type: "message", listener: (ev: WorkerMessage) => void): void;
  removeEventListener(type: "message", listener: (ev: WorkerMessage) => void): void;
}

export interface OgsNotificationsOptions {
  bridge: NotificationsBridge;
  /** The game's service worker container in a PWA (`navigator.serviceWorker`), if any. */
  serviceWorker?: ServiceWorkerLike;
  /** How long to wait for the app's notifications store before deciding there is none (300 ms). */
  timeoutMs?: number;
  newId?: () => string;
}

export const NOTIFICATIONS_TIMEOUT_MS = 300;

const parseState = (raw: unknown) => {
  const parsed = NotificationsBridgeStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

/**
 * Consent and swallowed pushes over any bridge and service worker. `request` asks the OGS app (null
 * outside it); `listen` hears pushes that arrive while the game is open and in front.
 */
export function createOgsNotifications(opts: OgsNotificationsOptions) {
  const { bridge } = opts;
  const newId = opts.newId ?? (() => crypto.randomUUID());

  /** Calls `withStore` once the app's store exists; `onMissing` if it never comes in time. */
  const whenStore = (
    withStore: (store: NonNullable<ReturnType<NotificationsBridge["getStore"]>>) => void,
    onMissing: () => void,
  ): (() => void) => {
    const now = bridge.getStore("notifications");
    if (now) {
      withStore(now);
      return () => {};
    }
    let done = false;
    const off = bridge.subscribe(() => {
      const store = bridge.getStore("notifications");
      if (!store || done) return;
      done = true;
      off();
      clearTimeout(timer);
      withStore(store);
    });
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      off();
      onMissing();
    }, opts.timeoutMs ?? NOTIFICATIONS_TIMEOUT_MS);
    return () => {
      done = true;
      off();
      clearTimeout(timer);
    };
  };

  function request(join?: { handle?: string }): Promise<PushConsentResult | null> {
    if (!bridge.isSupported()) return Promise.resolve(null);
    const id = newId();
    return new Promise((resolve) => {
      whenStore(
        (store) => {
          const off = store.subscribe((raw) => {
            const state = parseState(raw);
            if (state?.answer?.id !== id) return;
            off();
            resolve(state.answer.result);
          });
          store.dispatch({ type: "REQUEST", id, ...(join?.handle ? { handle: join.handle } : {}) });
        },
        () => resolve(null),
      );
    });
  }

  const handlers = new Set<(n: OgsNotification) => void>();
  let detach: (() => void) | null = null;

  const hear = (n: OgsNotification) => {
    for (const h of handlers) h(n);
  };

  /** From the app: each new `last` (its seq only grows), never the one there when we started. */
  const attachBridge = () => {
    let seen: number | null = null;
    let offState: (() => void) | null = null;
    let current: NonNullable<ReturnType<NotificationsBridge["getStore"]>> | null = null;
    const offWait = whenStore(
      (store) => {
        current = store;
        seen = parseState(store.getSnapshot())?.last?.seq ?? null;
        offState = store.subscribe((raw) => {
          const last = parseState(raw)?.last;
          if (!last || (seen !== null && last.seq <= seen)) return;
          seen = last.seq;
          hear(last.notification);
        });
        store.dispatch({ type: "LISTENING", on: true });
      },
      () => {},
    );
    return () => {
      offWait();
      offState?.();
      current?.dispatch({ type: "LISTENING", on: false });
    };
  };

  /** From the PWA's service worker: answer on its port that the page handled it. */
  const attachWorker = (sw: ServiceWorkerLike) => {
    const onMessage = (ev: WorkerMessage) => {
      const parsed = ServiceWorkerNotificationMessageSchema.safeParse(ev.data);
      if (!parsed.success) return;
      hear(parsed.data.notification);
      ev.ports[0]?.postMessage({ handled: true });
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  };

  function listen(handler: (n: OgsNotification) => void): () => void {
    handlers.add(handler);
    if (handlers.size === 1) {
      if (bridge.isSupported()) detach = attachBridge();
      else if (opts.serviceWorker) detach = attachWorker(opts.serviceWorker);
    }
    return () => {
      if (!handlers.delete(handler) || handlers.size > 0) return;
      detach?.();
      detach = null;
    };
  }

  return { request, listen };
}
