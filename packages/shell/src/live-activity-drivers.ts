import type { Event, State, Store } from "@open-game-system/app-bridge-types";
import {
  type LiveActivityAttributes,
  type LiveActivityRegistration,
  liveActivityChange,
  liveActivityDeepLink,
  OgsBridgeEventSchema,
  type SessionState,
  sessionContent,
  statusOfReport,
} from "@open-game-system/ogs-protocol";
import type { CastSession } from "./cast-store";
import type { LiveActivity } from "./live-activity";
import type { LiveActivityNative } from "./live-activity-native";

/**
 * What starts, updates and ends the controller's Live Activity, in either app: the game's own
 * INSTANCE_REPORTs over the `ogs` bridge store, the shell's cast session, the OGS app's couch
 * session; and where its push token goes (the couch session it belongs to).
 */

const GAME_NAME_MAX = 40;

/** The activity's fixed part for a game: name (clipped), deep link, room code and art if any. */
export function liveActivityAttributes(game: {
  appId: string;
  gameName: string;
  scheme: string;
  roomCode?: string | null;
  art?: string | null;
}): LiveActivityAttributes {
  const name = game.gameName.trim();
  return {
    appId: game.appId,
    gameName:
      name.length > GAME_NAME_MAX ? `${name.slice(0, GAME_NAME_MAX - 1)}…` : name || game.appId,
    deepLink: liveActivityDeepLink(game.scheme, game.appId),
    ...(game.roomCode ? { roomCode: game.roomCode } : {}),
    ...(game.art ? { art: game.art } : {}),
  };
}

/** The game's art (absolute, or relative to the OGS launcher that serves /art). */
export function artUrlOf(path: string, tvBase: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${tvBase.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Copies the key art into the app group for the widget; null (the monogram) when it can't. */
export async function prepareArt(
  native: Pick<LiveActivityNative, "prepareArt"> | null,
  url: string | null | undefined,
  appId: string,
): Promise<string | null> {
  if (!native || !url) return null;
  try {
    return await native.prepareArt(url, `${appId}.png`);
  } catch {
    return null;
  }
}

/**
 * A bridge event the game page sent through the `ogs` store: its INSTANCE_REPORT updates the
 * activity (only for `appId` when given). Anything else is ignored; the store parses it again.
 */
export function reportToActivity(activity: Pick<LiveActivity, "report">, appId?: string | null) {
  return (event: unknown): void => {
    const parsed = OgsBridgeEventSchema.safeParse(event);
    if (!parsed.success) return;
    const { report } = parsed.data;
    if (appId && report.appId !== appId) return;
    activity.report(statusOfReport(report));
  };
}

/** The `ogs` store, also telling `onEvent` about each event the page dispatches. */
export function teeStore<S extends State, E extends Event>(
  store: Store<S, E>,
  onEvent: (event: E) => void,
): Store<S, E> {
  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: (listener) => store.subscribe(listener),
    reset: () => store.reset(),
    on: (type, listener) => store.on(type, listener),
    dispatch(event) {
      onEvent(event);
      store.dispatch(event);
    },
  };
}

/**
 * The shell's cast session: connected = this phone is the controller for the game on the TV
 * (join), disconnected after that = the session ended (end).
 */
export function followCastSession(
  activity: Pick<LiveActivity, "join" | "end">,
  cast: { getSnapshot(): { session: CastSession }; subscribe(l: () => void): () => void },
  attributes: () => Promise<LiveActivityAttributes>,
): () => void {
  let connected = false;
  let generation = 0;
  const check = () => {
    const isConnected = cast.getSnapshot().session.status === "connected";
    if (isConnected === connected) return;
    connected = isConnected;
    const mine = ++generation;
    if (!isConnected) {
      activity.end();
      return;
    }
    void attributes().then((attrs) => {
      if (mine === generation) activity.join(attrs);
    });
  };
  const off = cast.subscribe(check);
  check();
  return off;
}

/**
 * The OGS app's couch session: a game on the cast TV joins (or changes) the activity, its label
 * updates it (only when the label changed, so the game's own richer report isn't overwritten by
 * an unrelated session change), and the cast ending or leaving the couch ends it.
 */
export function followCouch(
  activity: Pick<LiveActivity, "join" | "report" | "end" | "current">,
  couch: { getState(): SessionState | null; subscribe(l: () => void): () => void },
  attributesFor: (appId: string, state: SessionState) => Promise<LiveActivityAttributes | null>,
): () => void {
  let before: SessionState | null = null;
  let generation = 0;
  const check = () => {
    const after = couch.getState();
    const prev = before;
    before = after;
    if (!after) {
      if (prev && sessionContent(prev)) {
        generation++;
        activity.end();
      }
      return;
    }
    const change = liveActivityChange(prev, after);
    if (!change) return;
    const mine = ++generation;
    if (change.kind === "end") {
      activity.end();
      return;
    }
    const { appId, ...status } = change.content;
    if (activity.current()?.appId === appId) {
      activity.report(status);
      return;
    }
    void attributesFor(appId, after).then((attrs) => {
      if (attrs && mine === generation) activity.join(attrs, status);
    });
  };
  const off = couch.subscribe(check);
  check();
  return off;
}

/**
 * Sends each activity push token to OGS for the couch session it belongs to (remote updates while
 * the phone is locked). Without a session nothing is sent; failures are logged, never thrown.
 */
export function registerPushTokens(opts: {
  sessionId: () => string | null;
  app: string;
  environment: () => Promise<LiveActivityRegistration["environment"]>;
  post: (sessionId: string, registration: LiveActivityRegistration) => Promise<unknown>;
}) {
  return (token: { activityId: string; pushToken: string }): void => {
    const sid = opts.sessionId();
    if (!sid) return;
    void opts
      .environment()
      .then((environment) =>
        opts.post(sid, {
          activityId: token.activityId,
          pushToken: token.pushToken,
          app: opts.app,
          environment,
        }),
      )
      .catch((err: unknown) =>
        console.warn("[ogs-shell] could not register the Live Activity token:", err),
      );
  };
}
