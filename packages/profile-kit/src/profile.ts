import {
  type OgsProfile,
  type ProfileBridgeState,
  ProfileBridgeStateSchema,
} from "@open-game-system/ogs-protocol";

export type { OgsProfile, ProfileBridgeState };

/** The app-bridge store the OGS app gives a game's WebView (no events: the app refreshes it). */
export type ProfileStores = {
  profile: { state: ProfileBridgeState; events: { type: "REFRESH" } };
};

/** undefined = still asking the app · null = no OGS profile (plain browser) · the profile. */
export type ProfileSnapshot = OgsProfile | null | undefined;

/** An external store for useSyncExternalStore (getSnapshot is stable while nothing changed). */
export interface Source<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

/** What profile-kit needs of an app bridge (app-bridge-web's createWebBridge, or a mock). */
export interface ProfileBridge {
  isSupported(): boolean;
  getStore(
    key: "profile",
  ):
    | { getSnapshot(): unknown; subscribe(listener: (state: unknown) => void): () => void }
    | undefined;
  subscribe(listener: () => void): () => void;
}

export interface ProfileSourceOptions {
  bridge: ProfileBridge;
  /** How long to wait for the app's profile store before deciding there is none (300 ms). */
  timeoutMs?: number;
  /** How long the app may stay "asking" before the game shows its own form (5 s). */
  askingTimeoutMs?: number;
}

export const PROFILE_TIMEOUT_MS = 300;
export const ASKING_TIMEOUT_MS = 5000;

/**
 * The OGS profile as an external store. In the OGS app's WebView it follows the `profile` bridge
 * store (refreshed tokens included); in a plain browser it is null at once.
 */
export function createProfileSource(opts: ProfileSourceOptions): Source<ProfileSnapshot> {
  const { bridge } = opts;
  const listeners = new Set<() => void>();
  let noStoreTimedOut = false;
  let askingTimedOut = false;
  let cache: { raw: unknown; asking: boolean; value: ProfileSnapshot } | null = null;
  let emitted: ProfileSnapshot;
  let detach: (() => void) | null = null;

  const compute = (raw: unknown): ProfileSnapshot => {
    const parsed = ProfileBridgeStateSchema.safeParse(raw);
    if (!parsed.success) return null;
    if (parsed.data.status === "ready") return parsed.data.profile;
    if (parsed.data.status === "asking") return askingTimedOut ? null : undefined;
    return null;
  };

  const getSnapshot = (): ProfileSnapshot => {
    if (!bridge.isSupported()) return null;
    const store = bridge.getStore("profile");
    if (!store) return noStoreTimedOut ? null : undefined;
    const raw = store.getSnapshot();
    const last = cache;
    const fresh = last && last.raw === raw && last.asking === askingTimedOut ? last : null;
    const next = fresh ?? { raw, asking: askingTimedOut, value: compute(raw) };
    cache = next;
    return next.value;
  };

  const notify = () => {
    const now = getSnapshot();
    if (now === emitted) return;
    emitted = now;
    for (const l of listeners) l();
  };

  if (bridge.isSupported()) {
    setTimeout(() => {
      noStoreTimedOut = true;
      notify();
    }, opts.timeoutMs ?? PROFILE_TIMEOUT_MS);
    setTimeout(() => {
      askingTimedOut = true;
      notify();
    }, opts.askingTimeoutMs ?? ASKING_TIMEOUT_MS);
  }

  /** Follows the store's availability and, once it exists, its state. */
  const attach = () => {
    let offStore: (() => void) | null = null;
    const follow = () => {
      if (!offStore) offStore = bridge.getStore("profile")?.subscribe(notify) ?? null;
      notify();
    };
    const offBridge = bridge.subscribe(follow);
    follow();
    return () => {
      offBridge();
      offStore?.();
    };
  };

  return {
    getSnapshot,
    subscribe(listener) {
      if (listeners.size === 0) {
        emitted = getSnapshot();
        detach = attach();
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          detach?.();
          detach = null;
        }
      };
    },
  };
}
