import type { SessionState } from "@open-game-system/ogs-protocol";
import type { ReturnPill } from "./leave-game";

/**
 * Rejoin returns to the same room. A game's start page usually redirects into a fresh room (Rocket
 * Crew: `/` → `/host` → `/join/PQWS?t=<seat>&tv=<tv>`), so the URL the screen was opened with is
 * not where the player is. The game screen follows the WebView's navigations and remembers the
 * latest one per game; Rejoin (pill, Playing, Library, a host follow) opens that.
 */

export interface RememberedGame {
  appId: string;
  url: string;
  /** The session instance the URL belongs to (cast), or null when played on the phone alone. */
  instanceId: string | null;
}

/** The WebView navigated (or pushState'd) to `navUrl`: the game's new location, if it is a page. */
export function latestGameUrl(prev: string, navUrl: string | undefined): string {
  return navUrl && /^https?:\/\//.test(navUrl) ? navUrl : prev;
}

/** Where `appId` was left: its latest URL, tied to the session's live instance of it (if any). */
export function rememberGame(
  appId: string,
  url: string,
  session: SessionState | null,
): RememberedGame {
  const current = session?.current;
  return { appId, url, instanceId: current?.appId === appId ? current.instanceId : null };
}

/** One remembered URL per game for the app's lifetime. */
export function createGameUrls() {
  const byApp = new Map<string, RememberedGame>();
  return {
    record(entry: RememberedGame) {
      byApp.set(entry.appId, entry);
    },
    get: (appId: string): RememberedGame | undefined => byApp.get(appId),
  };
}

/**
 * The URL a Rejoin of `appId` opens, or undefined for the start page. Cast: only while the session
 * still holds that same instance (live, paused, or the one a host follow names). Phone only: while
 * that game's return pill is up.
 */
export function rejoinUrl(
  appId: string,
  ctx: {
    remembered: RememberedGame | undefined;
    session: SessionState | null;
    pill: ReturnPill | null;
    instanceId?: string;
  },
): string | undefined {
  const { remembered, session, pill } = ctx;
  if (!remembered) return undefined;
  if (remembered.instanceId === null) return pill?.appId === appId ? remembered.url : undefined;
  const target =
    ctx.instanceId ??
    (session?.current?.appId === appId ? session.current.instanceId : undefined) ??
    session?.suspended.find((g) => g.appId === appId)?.instanceId;
  return target === remembered.instanceId ? remembered.url : undefined;
}
