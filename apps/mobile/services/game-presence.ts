/**
 * Which game this phone has open. A phone that starts a game on the TV pushes the game itself and
 * then receives the session's host follow for it; without this the follow pushes a second copy
 * (two rooms, and swipe back reveals the duplicate instead of the tabs).
 */
export function createGamePresence() {
  let open: string | null = null;
  const closers = new Map<string, Set<() => void>>();
  const presence = {
    /** Called when the game screen is pushed (before it mounts: the follow can arrive first). */
    opening(appId: string) {
      open = appId;
    },
    /** Called when the game screen unmounts. */
    closed(appId: string) {
      if (open === appId) open = null;
    },
    isOpen: (appId: string) => open === appId,
    /** The game open here, if any. */
    openApp: (): string | null => open,
    /** The game screen of `appId` listens for the TV closing it (every couch phone follows the TV). */
    onClose(appId: string, close: () => void) {
      const set = closers.get(appId) ?? new Set();
      set.add(close);
      closers.set(appId, set);
      return () => {
        set.delete(close);
      };
    },
    /** The TV left `appId` (Home): close its screen here. */
    requestClose(appId: string) {
      for (const close of [...(closers.get(appId) ?? [])]) close();
    },
    /** The session says this phone hosts `appId`: open it unless it is already open here. */
    followHost(appId: string, openIt: () => void) {
      if (presence.isOpen(appId)) return;
      presence.opening(appId);
      openIt();
    },
  };
  return presence;
}
