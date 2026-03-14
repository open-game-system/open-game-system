import {
  BridgedWebView,
  createNativeBridgeContext,
  createNativeBridge,
  NativeBridge,
} from "@open-game-system/app-bridge-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View, StatusBar as RNStatusBar } from "react-native";
import { StatusBar } from "expo-status-bar";
import GoogleCast, {
  CastButton,
  useDevices,
} from "react-native-google-cast";
import {
  consumePendingGameUrl,
  subscribeToGameUrl,
} from "../services/game-url-store";
import {
  createCastStore,
  type CastStores,
  type CastDevice,
} from "../services/cast-store";
import {
  createCastSession,
  deleteCastSession,
} from "../services/cast-api";

// Configuration — read from env or use defaults
const OGS_API_URL = process.env.EXPO_PUBLIC_OGS_API_URL ?? "https://api.opengame.org";
const OGS_API_KEY = process.env.EXPO_PUBLIC_OGS_API_KEY ?? "";

// Create the bridge and cast store
const bridge: NativeBridge<CastStores> = createNativeBridge<CastStores>();
const castStore = createCastStore();
bridge.setStore("cast", castStore);

// Create context
const BridgeContext = createNativeBridgeContext<CastStores>();
const CastContext = BridgeContext.createNativeStoreContext("cast");

const CastStatus = () => {
  const isAvailable = CastContext.useSelector((state) => state.isAvailable);
  const deviceCount = CastContext.useSelector((state) => state.devices.length);
  const sessionStatus = CastContext.useSelector((state) => state.session.status);
  const deviceName = CastContext.useSelector((state) => state.session.deviceName);
  const error = CastContext.useSelector((state) => state.error);

  return (
    <View style={styles.castStatusContainer}>
      <Text style={styles.castStatusText}>
        Cast: {isAvailable ? `${deviceCount} device(s)` : 'No devices'}
      </Text>
      <Text style={styles.castStatusText}>Session: {sessionStatus}</Text>
      {deviceName && (
        <Text style={styles.castStatusText}>Device: {deviceName}</Text>
      )}
      {error && (
        <Text style={[styles.castStatusText, { color: '#c00' }]}>Error: {error}</Text>
      )}
    </View>
  );
};

export default function Index() {
  // --- Hooks for native state updates ---
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

  // Sync device discovery into bridge store
  useEffect(() => {
    const castDevices: CastDevice[] = devices.map((d) => ({
      id: d.deviceId,
      name: d.friendlyName,
      type: "chromecast" as const,
    }));

    const currentDevices = castStore.getSnapshot().devices;
    const devicesChanged = castDevices.length !== currentDevices.length ||
      castDevices.some((d, i) => d.id !== currentDevices[i]?.id);

    if (devicesChanged) {
      castStore.dispatch({ type: "DEVICES_UPDATED", devices: castDevices });
    }
  }, [devices]);

  // Track active cast session ID for cleanup on session end
  const castSessionIdRef = useRef<string | null>(null);

  // Subscribe to session lifecycle events
  useEffect(() => {
    const sessionManager = GoogleCast.sessionManager;

    const subs = [
      sessionManager.onSessionStarted((session) => {
        const currentDevices = castStore.getSnapshot().devices;
        if (currentDevices.length === 0) return;

        const device = currentDevices[0];
        castStore.dispatch({ type: "START_CASTING", deviceId: device.id });

        // Call API to create cast session
        const viewUrl = webviewSource.uri;
        createCastSession(OGS_API_URL, OGS_API_KEY, device.id, viewUrl)
          .then((result) => {
            castSessionIdRef.current = result.sessionId;
            castStore.dispatch({
              type: "SESSION_CONNECTED",
              deviceId: device.id,
              deviceName: device.name,
              sessionId: result.sessionId,
              streamSessionId: result.streamSessionId,
            });

            // Send streamUrl to Chromecast via Cast SDK
            const client = session.getClient();
            client.loadMedia({
              mediaInfo: {
                contentUrl: result.streamUrl,
                contentType: "application/x-mpegurl",
              },
            }).catch(() => {
              // Best effort — media loading failure is non-fatal
            });
          })
          .catch((err: Error) => {
            castStore.dispatch({ type: "SET_ERROR", error: err.message });
          });
      }),
      sessionManager.onSessionEnded(() => {
        const sessionId = castSessionIdRef.current;
        if (sessionId) {
          deleteCastSession(OGS_API_URL, OGS_API_KEY, sessionId).catch(() => {
            // Best effort — session is ending regardless
          });
          castSessionIdRef.current = null;
        }
        castStore.dispatch({ type: "STOP_CASTING" });
      }),
      sessionManager.onSessionResumed(() => {
        // Session resumed — mark as connecting until we verify with API
        const currentDevices = castStore.getSnapshot().devices;
        if (currentDevices.length > 0) {
          castStore.dispatch({ type: "START_CASTING", deviceId: currentDevices[0].id });
        }
      }),
    ];

    return () => subs.forEach((s) => s.remove());
  }, [webviewSource]);

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
