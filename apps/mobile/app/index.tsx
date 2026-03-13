import {
  BridgedWebView,
  createNativeBridgeContext,
  createNativeBridge,
  createStore,
  NativeBridge,
} from "@open-game-system/app-bridge-react-native";
import type { Producer, State } from "@open-game-system/app-bridge-types";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View, StatusBar as RNStatusBar } from "react-native";
import { StatusBar } from "expo-status-bar";
import GoogleCast, {
  CastButton,
  useCastState,
  CastState,
  useDevices,
} from "react-native-google-cast";
import {
  consumePendingGameUrl,
  subscribeToGameUrl,
} from "../services/game-url-store";

interface CastKitState extends State {
  // Connection & Device Discovery
  castState: CastState;
  devicesAvailable: boolean;

  // Session Management
  sessionState?: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
}

type CastKitEvents =
  | { type: "CAST_STATE_CHANGED"; payload: CastState }
  | { type: "DEVICES_DISCOVERED"; payload: boolean }
  | { type: "SESSION_STARTED" }
  | { type: "SESSION_ENDED" }
  | { type: "SESSION_RESUMED" }
  | { type: 'SHOW_CAST_PICKER' };

type AppStores = {
  castKit: {
    state: CastKitState;
    events: CastKitEvents;
  };
};

// Create the bridge instance
const bridge: NativeBridge<AppStores> = createNativeBridge<AppStores>();

const castKitProducer: Producer<CastKitState, CastKitEvents> = (draft, event) => {
  switch (event.type) {
    case "CAST_STATE_CHANGED":
      draft.castState = event.payload;
      break;
    case "DEVICES_DISCOVERED":
      draft.devicesAvailable = event.payload;
      break;
    case "SESSION_STARTED":
      draft.sessionState = 'CONNECTED';
      break;
    case "SESSION_ENDED":
      draft.sessionState = 'DISCONNECTED';
      break;
    case "SESSION_RESUMED":
      draft.sessionState = 'CONNECTED';
      break;
    case 'SHOW_CAST_PICKER':
      // No state change needed here, handled by 'on' listener
      break;
  }
};

// Create and register the castKit store with 'on' config for side effects
const castKitStore = createStore<CastKitState, CastKitEvents>({
  initialState: {
    castState: CastState.NOT_CONNECTED,
    devicesAvailable: false,
    sessionState: undefined,
  },
  producer: castKitProducer,
  on: {
    SHOW_CAST_PICKER: (event: Extract<CastKitEvents, { type: 'SHOW_CAST_PICKER' }>) => {
      console.log(`[Native Store Listener] Received ${event.type}`);
      GoogleCast.showCastDialog();
    },
  }
});

bridge.setStore("castKit", castKitStore);

// Create context
const BridgeContext = createNativeBridgeContext<AppStores>();
const CastContext = BridgeContext.createNativeStoreContext("castKit");

function getCastStateLabel(state: CastState): string {
  switch (state) {
    case CastState.NO_DEVICES_AVAILABLE: return 'NO_DEVICES_AVAILABLE';
    case CastState.NOT_CONNECTED: return 'NOT_CONNECTED';
    case CastState.CONNECTING: return 'CONNECTING';
    case CastState.CONNECTED: return 'CONNECTED';
    default: return CastState[state] ?? 'UNKNOWN';
  }
}

const CastStatus = () => {
  const currentCastState = CastContext.useSelector((state) => state.castState);
  const devicesAvailable = CastContext.useSelector((state) => state.devicesAvailable);
  const sessionState = CastContext.useSelector((state) => state.sessionState);

  return (
    <View style={styles.castStatusContainer}>
      <Text style={styles.castStatusText}>Cast State: {getCastStateLabel(currentCastState)}</Text>
      <Text style={styles.castStatusText}>Devices Available: {devicesAvailable ? 'Yes' : 'No'}</Text>
      {sessionState && (
        <Text style={styles.castStatusText}>Session: {sessionState}</Text>
      )}
    </View>
  );
};

export default function Index() {
  // --- Hooks for native state updates ---
  const castState = useCastState();
  const devices = useDevices();

  // Track the current URL to load in the WebView
  const defaultSource = useMemo(() => Platform.select({
    ios: { uri: "http://localhost:8787" }, // Use localhost for iOS simulator
    android: { uri: "http://10.0.2.2:8787" }, // Use 10.0.2.2 for Android emulator
    default: { uri: "http://localhost:8787" } // Default fallback
  }), []);

  const [webviewSource, setWebviewSource] = useState(defaultSource);

  // Handle game URLs from deep links and notifications
  useEffect(() => {
    // Check for a pending game URL (e.g., from a cold start deep link)
    const pending = consumePendingGameUrl();
    if (pending) {
      console.log("[Index] Loading pending game URL:", pending);
      setWebviewSource({ uri: pending });
    }

    // Subscribe to future game URL changes (warm start deep links, notification taps)
    const unsubscribe = subscribeToGameUrl((gameUrl) => {
      console.log("[Index] Loading game URL from deep link:", gameUrl);
      setWebviewSource({ uri: gameUrl });
    });

    return unsubscribe;
  }, []);

  // Show introductory overlay on first mount
  useEffect(() => {
    GoogleCast.showIntroductoryOverlay().catch(() => {});
  }, []);

  // Sync native cast state into bridge store
  useEffect(() => {
    if (castState != null) {
      castKitStore.dispatch({ type: 'CAST_STATE_CHANGED', payload: castState });
    }
  }, [castState]);

  // Sync device discovery into bridge store
  useEffect(() => {
    const devicesAvailable = devices.length > 0;
    if (devicesAvailable !== castKitStore.getSnapshot().devicesAvailable) {
      castKitStore.dispatch({ type: 'DEVICES_DISCOVERED', payload: devicesAvailable });
    }
  }, [devices]);

  // Subscribe to session lifecycle events
  useEffect(() => {
    const sessionManager = GoogleCast.sessionManager;

    const subs = [
      sessionManager.onSessionStarted(() => {
        castKitStore.dispatch({ type: 'SESSION_STARTED' });
      }),
      sessionManager.onSessionEnded(() => {
        castKitStore.dispatch({ type: 'SESSION_ENDED' });
      }),
      sessionManager.onSessionResumed(() => {
        castKitStore.dispatch({ type: 'SESSION_RESUMED' });
      }),
    ];

    return () => subs.forEach((s) => s.remove());
  }, []);

  return (
    <BridgeContext.BridgeProvider bridge={bridge}>
      <View style={styles.container}>
        <StatusBar style="auto" />
        <CastContext.StoreProvider>
          <View style={styles.castContainer}>
            <CastButton style={styles.castButton} />
            <CastStatus />
          </View>
          <View style={styles.webviewContainer}>
            <BridgedWebView
              bridge={bridge}
              source={webviewSource}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={true}
            />
          </View>
        </CastContext.StoreProvider>
      </View>
    </BridgeContext.BridgeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    // Use RNStatusBar for Android height, otherwise use a fixed value for iOS
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 50,
  },
  castContainer: {
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    flexDirection: 'row',
    alignItems: 'center',
  },
  castButton: {
    width: 30,
    height: 30,
    tintColor: 'black',
    marginRight: 16,
  },
  castStatusContainer: {
  },
  castStatusText: {
    fontSize: 14,
    color: "#666",
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
