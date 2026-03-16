import {
  BridgedWebView,
  createNativeBridgeContext,
  createNativeBridge,
  NativeBridge,
} from "@open-game-system/app-bridge-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import GoogleCast, {
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;
const EDGE_WIDTH = 30;

// Create the bridge and cast store
const bridge: NativeBridge<CastStores> = createNativeBridge<CastStores>();
const castStore = createCastStore();
bridge.setStore("cast", castStore);

// Create context
const BridgeContext = createNativeBridgeContext<CastStores>();
const CastContext = BridgeContext.createNativeStoreContext("cast");

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; name?: string }>();
  const translateX = useRef(new Animated.Value(0)).current;

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
    if (params.url) {
      return { uri: params.url };
    }
    const pending = consumePendingGameUrl();
    if (pending) {
      return { uri: pending };
    }
    return defaultSource;
  });

  useEffect(() => {
    if (params.url) {
      setWebviewSource({ uri: params.url });
    }
  }, [params.url]);

  const gameName = params.name || "Game";

  // Record this game in history
  useEffect(() => {
    const url = webviewSource.uri;
    const isLocalDev =
      url.includes("localhost") ||
      url.includes("10.0.2.2") ||
      url.includes(".local:");
    if (url && !isLocalDev) {
      addRecentGame(url, gameName);
    }
  }, [webviewSource.uri, gameName]);

  // Subscribe to future game URL changes
  useEffect(() => {
    const unsubscribe = subscribeToGameUrl((gameUrl) => {
      setWebviewSource({ uri: gameUrl });
    });
    return unsubscribe;
  }, []);

  // Show cast introductory overlay
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
      castStore.dispatch({ type: "DEVICES_UPDATED", devices: castDevices });
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

  // Swipe-back gesture using PanResponder (edge-only, left side)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        // Only activate on touches near the left edge
        return evt.nativeEvent.pageX < EDGE_WIDTH;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only activate for rightward swipes starting from left edge
        return evt.nativeEvent.pageX < EDGE_WIDTH + 20 && gestureState.dx > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            router.back();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <BridgeContext.BridgeProvider bridge={bridge}>
      <View style={styles.container} testID="gameScreen">
        <StatusBar style="light" />
        <Animated.View
          style={[
            styles.fullScreen,
            { transform: [{ translateX }] },
          ]}
          {...panResponder.panHandlers}
        >
          <CastContext.StoreProvider>
            <View style={styles.webviewContainer} testID="gameWebView">
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
        </Animated.View>
      </View>
    </BridgeContext.BridgeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  fullScreen: {
    flex: 1,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
