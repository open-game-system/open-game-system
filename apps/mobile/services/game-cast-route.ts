import type { ClientMessage } from "@open-game-system/ogs-protocol";
import type { NativeCastEvents } from "./cast-store";

export type GameCastRoute =
  | { to: "session"; msg: Extract<ClientMessage, { type: "game.view" }> }
  | { to: "store" }
  | { to: "drop" };

const isAbsoluteUrl = (url: string) => /^https?:\/\/[^/]/.test(url);

/**
 * Where a cast-kit event from the game's page goes. Cast through OGS, the receiver keeps the
 * launcher for the whole cast: the game's TV page (useCastViewUrl → SET_VIEW_URL) is sent to the couch
 * session as game.view for the launcher to frame, and the game's own cast buttons are ignored.
 * Not cast through OGS, everything takes today's path through the cast store.
 */
export function routeGameCastEvent(
  event: NativeCastEvents,
  ctx: { ogsCast: boolean; appId: string | null },
): GameCastRoute {
  if (!ctx.ogsCast) return { to: "store" };
  switch (event.type) {
    case "SET_VIEW_URL":
      return viewRoute(event.url, ctx.appId);
    case "START_CASTING":
    case "STOP_CASTING":
    case "SHOW_CAST_PICKER":
      return { to: "drop" };
    default:
      return { to: "store" };
  }
}

/** The game's TV page goes to the session as game.view (only a real URL of a known game). */
function viewRoute(url: string, appId: string | null): GameCastRoute {
  if (!appId || !isAbsoluteUrl(url)) return { to: "drop" };
  return { to: "session", msg: { type: "game.view", appId, url } };
}

/**
 * Is the TV cast through OGS (the launcher is the receiver's view)? Either the couch session says
 * a launcher is connected, or this phone's own cast session is showing the launcher URL.
 */
export function isOgsCast(input: {
  sessionCast: boolean | undefined;
  castConnected: boolean;
  viewIsLauncher: boolean;
}): boolean {
  return input.sessionCast === true || (input.castConnected && input.viewIsLauncher);
}
