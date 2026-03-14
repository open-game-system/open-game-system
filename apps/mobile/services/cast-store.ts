import { createStore } from "@open-game-system/app-bridge-native";
import type { Producer, State, Store } from "@open-game-system/app-bridge-types";
import GoogleCast from "react-native-google-cast";

/**
 * Native cast store state — aligned with @open-game-system/cast-kit-core CastState.
 *
 * This is the native-side source of truth for casting state.
 * It syncs to web games via app-bridge.
 */
export interface CastDevice {
  id: string;
  name: string;
  type: "chromecast" | "airplay";
}

export interface CastSession {
  status: "disconnected" | "connecting" | "connected";
  deviceId: string | null;
  deviceName: string | null;
  sessionId: string | null;
  streamSessionId: string | null;
}

export interface NativeCastState extends State {
  isAvailable: boolean;
  devices: CastDevice[];
  session: CastSession;
  error: string | null;
}

/**
 * Events the cast store handles.
 *
 * Some are dispatched from the native side (DEVICES_UPDATED, SESSION_CONNECTED),
 * some from the web side via app-bridge (START_CASTING, STOP_CASTING, SHOW_CAST_PICKER).
 */
export type NativeCastEvents =
  | { type: "DEVICES_UPDATED"; devices: CastDevice[] }
  | { type: "START_CASTING"; deviceId: string }
  | { type: "STOP_CASTING" }
  | { type: "SESSION_CONNECTED"; deviceId: string; deviceName: string; sessionId: string; streamSessionId: string }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET_ERROR" }
  | { type: "SCAN_DEVICES" }
  | { type: "SHOW_CAST_PICKER" }
  | { type: "SEND_STATE_UPDATE"; payload: unknown };

export type CastStores = {
  cast: {
    state: NativeCastState;
    events: NativeCastEvents;
  };
};

export const CAST_INITIAL_STATE: NativeCastState = {
  isAvailable: false,
  devices: [],
  session: {
    status: "disconnected",
    deviceId: null,
    deviceName: null,
    sessionId: null,
    streamSessionId: null,
  },
  error: null,
};

const castProducer: Producer<NativeCastState, NativeCastEvents> = (draft, event) => {
  switch (event.type) {
    case "DEVICES_UPDATED":
      draft.devices = event.devices;
      draft.isAvailable = event.devices.length > 0;
      break;

    case "START_CASTING":
      draft.session.status = "connecting";
      draft.session.deviceId = event.deviceId;
      draft.error = null;
      break;

    case "SESSION_CONNECTED":
      draft.session.status = "connected";
      draft.session.deviceId = event.deviceId;
      draft.session.deviceName = event.deviceName;
      draft.session.sessionId = event.sessionId;
      draft.session.streamSessionId = event.streamSessionId;
      draft.error = null;
      break;

    case "STOP_CASTING":
      draft.session.status = "disconnected";
      draft.session.deviceId = null;
      draft.session.deviceName = null;
      draft.session.sessionId = null;
      draft.session.streamSessionId = null;
      draft.error = null;
      break;

    case "SET_ERROR":
      draft.error = event.error;
      break;

    case "RESET_ERROR":
      draft.error = null;
      break;

    case "SCAN_DEVICES":
    case "SHOW_CAST_PICKER":
    case "SEND_STATE_UPDATE":
      // No state changes — these are side-effect or forwarded events
      break;
  }
};

/**
 * Creates the native cast store instance.
 * Registers side effects for SHOW_CAST_PICKER (opens native Cast dialog).
 */
export function createCastStore(): Store<NativeCastState, NativeCastEvents> {
  return createStore<NativeCastState, NativeCastEvents>({
    initialState: CAST_INITIAL_STATE,
    producer: castProducer,
    on: {
      SHOW_CAST_PICKER: () => {
        GoogleCast.showCastDialog();
      },
    },
  });
}
