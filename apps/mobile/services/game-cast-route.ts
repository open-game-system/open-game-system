import type { ClientMessage } from "@open-game-system/ogs-protocol";
import type { NativeCastEvents } from "./cast-store";

export type GameCastRoute =
  | { to: "session"; msg: Extract<ClientMessage, { type: "game.view" }> }
  | { to: "store" }
  | { to: "drop" };

const isAbsoluteUrl = (url: string) => /^https?:\/\/[^/]/.test(url);

/**
 * Where a cast-kit event from the game's page goes. Cast through OGS, the receiver keeps the
 * launcher all evening: the game's TV page (useCastViewUrl → SET_VIEW_URL) is sent to the couch
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
      if (!ctx.appId || !isAbsoluteUrl(event.url)) return { to: "drop" };
      return { to: "session", msg: { type: "game.view", appId: ctx.appId, url: event.url } };
    case "START_CASTING":
    case "STOP_CASTING":
    case "SHOW_CAST_PICKER":
      return { to: "drop" };
    default:
      return { to: "store" };
  }
}
