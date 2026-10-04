import { useFocusEffect } from "expo-router";
import { useCallback, useSyncExternalStore } from "react";
import { joinCards } from "../components/ogs/friends/friends-view";
import { createFriendsApi } from "./friends-api";
import { createFriendsStore } from "./friends-store";
import { appState, config, useApp } from "./runtime";

/**
 * Friends wired for the app: the client (this device's profile token), the store, and the hooks
 * screens use. No pushes yet: Friends refreshes when it is shown and every 15 s while it stays
 * shown; Playing polls the Join cards the same way.
 */

const POLL_MS = 15_000;

export const friendsApi = createFriendsApi({
  baseUrl: config.apiBase,
  fetch: (url, init) => fetch(url, init),
  auth: () => {
    const id = appState.getSnapshot().identity;
    return id ? { token: id.deviceToken } : null;
  },
});

export const friendsStore = createFriendsStore({
  api: friendsApi,
  joinFriendSession: (sessionId) => appState.joinFriendSession(sessionId),
});

const hasProfile = () => appState.getSnapshot().identity !== null;

/** Runs `load` when the screen gains focus and every POLL_MS while it keeps it. */
function usePollWhileFocused(load: () => Promise<void>) {
  useFocusEffect(
    useCallback(() => {
      const tick = () => {
        if (hasProfile()) void load();
      };
      tick();
      const timer = setInterval(tick, POLL_MS);
      return () => clearInterval(timer);
    }, [load]),
  );
}

export function useFriends() {
  usePollWhileFocused(friendsStore.refresh);
  return useSyncExternalStore(
    friendsStore.subscribe,
    friendsStore.getSnapshot,
    friendsStore.getSnapshot,
  );
}

/** The Join cards for Playing: friends' live casts, minus the one this device is on. */
export function useFriendCasts() {
  usePollWhileFocused(friendsStore.refreshCasting);
  const { casting } = useSyncExternalStore(
    friendsStore.subscribe,
    friendsStore.getSnapshot,
    friendsStore.getSnapshot,
  );
  const session = useApp().session;
  return joinCards(casting, session?.sessionId ?? null);
}
