/**
 * Which game this phone has open. A phone that starts a game on the TV pushes the game itself and
 * then receives the session's host follow for it; without this the follow pushes a second copy
 * (two rooms, and swipe back reveals the duplicate instead of the tabs).
 */
export function createGamePresence() {
  let open: string | null = null;
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
    /** The session says this phone hosts `appId`: open it unless it is already open here. */
    followHost(appId: string, openIt: () => void) {
      if (presence.isOpen(appId)) return;
      presence.opening(appId);
      openIt();
    },
  };
  return presence;
}
