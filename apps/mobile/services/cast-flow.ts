import type { Store } from "@open-game-system/app-bridge-types";
import type { ClientMessage } from "@open-game-system/ogs-protocol";
import type { StopResult } from "./cast-stop";
import type { NativeCastEvents, NativeCastState } from "./cast-store";
import type { SessionManagerLike } from "./cast-sync";
import { type AppConfig, launcherUrl } from "./config";
import { routeGameCastEvent } from "./game-cast-route";

type CastStore = Store<NativeCastState, NativeCastEvents>;

/**
 * TV tab → Cast: get a launcher token, point the receiver's view at the launcher, start the
 * session. cast-sync then sends LOAD_VIEW once when the session connects; nothing a game does
 * later sends another.
 */
export async function castToTv(input: {
  api: { launcherToken(): Promise<string> };
  config: AppConfig;
  castStore: CastStore;
  backend: { sessionManager: SessionManagerLike };
  deviceId: string;
}): Promise<"started" | "no-tv"> {
  const token = await input.api.launcherToken();
  input.castStore.dispatch({ type: "SET_VIEW_URL", url: launcherUrl(input.config, token) });
  const ok = await input.backend.sessionManager.startSession(input.deviceId).catch(() => false);
  return ok ? "started" : "no-tv";
}

/**
 * Remote → TV picker: move the evening to another TV. Stops the cast on the old TV (without
 * ending the couch session, so the current game keeps its place), then casts the launcher to the
 * new one. Picking the TV you're already on does nothing.
 */
export async function switchTv(
  input: Parameters<typeof castToTv>[0],
): Promise<"started" | "no-tv" | "same"> {
  const { session } = input.castStore.getSnapshot();
  if (session.status === "connected" && session.deviceId === input.deviceId) return "same";
  await input.backend.sessionManager.endCurrentSession(true).catch(() => {});
  return castToTv(input);
}

/** Remote → Stop casting (was "End for tonight"): the session suspends the game and goes home, then the cast stops. */
export async function endForTonight(input: {
  send: (msg: ClientMessage) => void;
  sessionManager: SessionManagerLike;
}): Promise<StopResult> {
  input.send({ type: "end" });
  return input.sessionManager.endCurrentSession(true).then(
    (): StopResult => "stopped",
    (): StopResult => "failed",
  );
}

/**
 * The "cast" store a game page sees over app-bridge: the app's cast state, with the game's events
 * routed by routeGameCastEvent (game.view to the session while cast through OGS).
 */
export function createGameCastStore(
  castStore: CastStore,
  context: () => { ogsCast: boolean; appId: string | null },
  send: (msg: ClientMessage) => void,
): CastStore {
  return {
    getSnapshot: () => castStore.getSnapshot(),
    subscribe: (listener) => castStore.subscribe(listener),
    reset: () => castStore.reset(),
    on: (type, listener) => castStore.on(type, listener),
    dispatch(event) {
      const route = routeGameCastEvent(event, context());
      if (route.to === "session") send(route.msg);
      else if (route.to === "store") castStore.dispatch(event);
    },
  };
}
