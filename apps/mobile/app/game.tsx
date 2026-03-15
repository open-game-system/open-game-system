import {
  BridgedWebView,
  createNativeBridgeContext,
  createNativeBridge,
  NativeBridge,
} from "@open-game-system/app-bridge-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import GoogleCast, {
  CastButton,
  useDevices,
} from "react-native-google-cast";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  consumePendingGameUrl,
  subscribeToGameUrl,
} from "../services/game-url-store";
import {
  createCastStore,
  type CastStores,
  type CastDevice,
} from "../services/cast-store";
import { addRecentGame } from "../services/game-history";

// Create the bridge and cast store
console.log("[GameScreen] Creating native bridge and cast store");
const bridge: NativeBridge<CastStores> = createNativeBridge<CastStores>();
const castStore = createCastStore();
bridge.setStore("cast", castStore);
console.log("[GameScreen] Bridge created, cast store set. Initial state:", JSON.stringify(castStore.getSnapshot()));

// Create context
const BridgeContext = createNativeBridgeContext<CastStores>();
const CastContext = BridgeContext.createNativeStoreContext("cast");

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; name?: string }>();

  // --- Hooks for native state updates ---
  const devices = useDevices();

  // Determine the game URL from params, pending URL, or default
  const defaultSource = useMemo(
    () =>
      Platform.select({
        ios: { uri: "http://Jonathans-MacBook-Pro.local:3000" },
        android: { uri: "http://10.0.2.2:8787" },
        default: { uri: "http://localhost:8787" },
      }),
    []
  );

  const [webviewSource, setWebviewSource] = useState(() => {
    // Check route params first
    if (params.url) {
      return { uri: params.url };
    }
    // Check for pending game URL (from deep link cold start)
    const pending = consumePendingGameUrl();
    if (pending) {
      return { uri: pending };
    }
    return defaultSource;
  });

  const gameName = params.name || "Game";

  // Record this game in history
  useEffect(() => {
    const url = webviewSource.uri;
    if (url && !url.includes("localhost") && !url.includes("10.0.2.2")) {
      addRecentGame(url, gameName);
    }
  }, [webviewSource.uri, gameName]);

  // Subscribe to future game URL changes (warm start deep links, notification taps)
  useEffect(() => {
    const unsubscribe = subscribeToGameUrl((gameUrl) => {
      console.log("[GameScreen] Loading game URL from deep link:", gameUrl);
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
    const devicesChanged =
      castDevices.length !== currentDevices.length ||
      castDevices.some((d, i) => d.id !== currentDevices[i]?.id);

    if (devicesChanged) {
      console.log("[GameScreen] Devices changed:", JSON.stringify(castDevices));
      castStore.dispatch({ type: "DEVICES_UPDATED", devices: castDevices });
      console.log("[GameScreen] Cast store state after device update:", JSON.stringify(castStore.getSnapshot()));
    }
  }, [devices]);

  // Subscribe to session lifecycle events
  useEffect(() => {
    const sessionManager = GoogleCast.sessionManager;

    const subs = [
      sessionManager.onSessionStarted(() => {
        const currentDevices = castStore.getSnapshot().devices;
        if (currentDevices.length > 0) {
          castStore.dispatch({
            type: "START_CASTING",
            deviceId: currentDevices[0].id,
          });
        }
      }),
      sessionManager.onSessionEnded(() => {
        castStore.dispatch({ type: "STOP_CASTING" });
      }),
      sessionManager.onSessionResumed(() => {
        const currentDevices = castStore.getSnapshot().devices;
        if (currentDevices.length > 0) {
          castStore.dispatch({
            type: "START_CASTING",
            deviceId: currentDevices[0].id,
          });
        }
      }),
    ];

    return () => subs.forEach((s) => s.remove());
  }, []);

  return (
    <BridgeContext.BridgeProvider bridge={bridge}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>{"← Back"}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {gameName}
          </Text>
          <CastContext.StoreProvider>
            <CastButton style={styles.castButton} />
          </CastContext.StoreProvider>
        </View>
        <CastContext.StoreProvider>
          <View style={styles.webviewContainer}>
            <BridgedWebView
              bridge={bridge}
              source={webviewSource}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={true}
              webviewDebuggingEnabled={true}
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
    backgroundColor: "#000",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    paddingRight: 12,
  },
  backButtonText: {
    color: "#a855f6",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  castButton: {
    width: 30,
    height: 30,
    tintColor: "#fff",
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
