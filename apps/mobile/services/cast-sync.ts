import type { Store } from "@open-game-system/app-bridge-types";
import GoogleCast from "react-native-google-cast";
import { sessionConnectedEvent } from "./cast-session-device";
import type { CastCommands, CastDevice, NativeCastEvents, NativeCastState } from "./cast-store";
import { connectViewChannel, type ViewChannelSession } from "./cast-view";

type Subscription = { remove(): void };
type Session = ViewChannelSession & {
  getCastDevice(): Promise<{ deviceId: string; friendlyName: string } | null>;
};

/** The slice of react-native-google-cast's SessionManager this needs (keeps it testable). */
export type SessionManagerLike = {
  getCurrentCastSession(): Promise<Session | null>;
  startSession(deviceId: string): Promise<boolean>;
  endCurrentSession(stopCasting?: boolean): Promise<void>;
  onSessionStarting(handler: () => void): Subscription;
  onSessionStarted(handler: (session: Session) => void): Subscription;
  onSessionStartFailed(handler: (session: Session, error: string) => void): Subscription;
  onSessionSuspended(handler: () => void): Subscription;
  onSessionResumed(handler: (session: Session) => void): Subscription;
  onSessionEnded(handler: () => void): Subscription;
};

/**
 * The game's cast buttons, run against the real session. Created before the store (the store's
 * side effects call these) and bound to the SessionManager when sync starts.
 */
export function castCommands(
  showCastDialog: () => void = () => GoogleCast.showCastDialog(),
): CastCommands & { bind(sm: SessionManagerLike): void } {
  let sm: SessionManagerLike | null = null;
  return {
    bind(next) {
      sm = next;
    },
    startCasting(deviceId: string, devices: CastDevice[]) {
      if (sm && devices.some((d) => d.id === deviceId))
        void sm.startSession(deviceId).catch(() => showCastDialog());
      else showCastDialog();
    },
    stopCasting() {
      // true: also stop the receiver app on the TV, not just disconnect this phone.
      void sm?.endCurrentSession(true).catch(() => {});
    },
  };
}

/**
 * Keeps the cast store in step with the real Google Cast session for the app's lifetime: picks up
 * a session that already exists, follows every lifecycle event (including failures and
 * suspensions), and keeps the receiver supplied with the game's TV page. Returns a teardown.
 */
export function startCastSync(
  store: Store<NativeCastState, NativeCastEvents>,
  sm: SessionManagerLike,
  commands: { bind(sm: SessionManagerLike): void },
  streamServerUrl: string,
): () => void {
  commands.bind(sm);
  let channel: { send(): Promise<void> } | null = null;
  let generation = 0;

  const connected = (session: Session) => {
    const mine = ++generation;
    channel = null;
    void connectViewChannel(session, () => store.getSnapshot().viewUrl, streamServerUrl).then(
      (c) => {
        if (mine === generation) channel = c;
      },
    );
    void session
      .getCastDevice()
      .catch(() => null)
      .then((device) => {
        if (mine === generation)
          store.dispatch(sessionConnectedEvent(device, store.getSnapshot().devices));
      });
  };
  const ended = () => {
    generation++;
    channel = null;
    store.dispatch({ type: "SESSION_ENDED" });
  };

  const subs: Subscription[] = [
    sm.onSessionStarting(() => store.dispatch({ type: "SESSION_STARTING" })),
    sm.onSessionStarted(connected),
    sm.onSessionResumed(connected),
    sm.onSessionSuspended(() => store.dispatch({ type: "SESSION_STARTING" })),
    sm.onSessionStartFailed((_session, error) => {
      ended();
      store.dispatch({ type: "SET_ERROR", error: `Couldn't start casting: ${error}` });
    }),
    sm.onSessionEnded(ended),
  ];

  // The game's TV page changed (e.g. a new room): tell the receiver.
  let lastViewUrl = store.getSnapshot().viewUrl;
  const unsubscribe = store.subscribe((state) => {
    if (state.viewUrl && state.viewUrl !== lastViewUrl) {
      lastViewUrl = state.viewUrl;
      void channel?.send();
    }
  });

  // A session may already be running (app reopened while casting).
  void sm
    .getCurrentCastSession()
    .then((session) => {
      if (session) connected(session);
    })
    .catch(() => {});

  return () => {
    generation++;
    subs.forEach((s) => s.remove());
    unsubscribe();
  };
}
