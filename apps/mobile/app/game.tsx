import {
  BridgedWebView,
  createNativeBridgeContext,
  createNativeBridge,
  NativeBridge,
} from "@open-game-system/app-bridge-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import GoogleCast, { useDevices } from "react-native-google-cast";
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
import { findGameByUrl } from "../services/game-directory";
import { GameLoadingOverlay } from "../components/GameLoadingOverlay";
import { GameErrorScreen } from "../components/GameErrorScreen";
import { SwipeHintOverlay, useSwipeHint } from "../components/SwipeHintOverlay";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;
const EDGE_WIDTH = 30;

// Module-level singletons for bridge + cast
const bridge: NativeBridge<CastStores> = createNativeBridge<CastStores>();
const castStore = createCastStore();
bridge.setStore("cast", castStore);
const BridgeContext = createNativeBridgeContext<CastStores>();
const CastContext = BridgeContext.createNativeStoreContext("cast");

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; name?: string }>();
  const translateX = useRef(new Animated.Value(0)).current;
  const devices = useDevices();
  const [showSwipeHint, dismissSwipeHint] = useSwipeHint();

  // --- Source resolution ---
  const defaultSource = useMemo(
    () =>
      Platform.select({
        ios: { uri: "http://Jonathans-MacBook-Pro.local:3000" },
        android: { uri: "http://10.0.2.2:8787" },
        default: { uri: "http://localhost:8787" },
      }),
    []
  );

  const initialSource = useMemo(() => {
    if (params.url) return { uri: params.url };
    const pending = consumePendingGameUrl();
    if (pending) return { uri: pending };
    return defaultSource;
  }, [params.url, defaultSource]);

  const [webviewSource, setWebviewSource] = useState(initialSource);

  // Sync when initialSource changes (no useEffect — direct render-phase check)
  const prevInitialUri = useRef(initialSource.uri);
  if (initialSource.uri !== prevInitialUri.current) {
    prevInitialUri.current = initialSource.uri;
    setWebviewSource(initialSource);
  }

  // --- Derived values ---
  const gameName = params.name || "Game";
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const gameInfo = useMemo(() => findGameByUrl(webviewSource.uri), [webviewSource.uri]);
  const originDomain = useMemo(() => {
    try { return new URL(webviewSource.uri).hostname; }
    catch { return webviewSource.uri; }
  }, [webviewSource.uri]);

  // --- Handlers ---
  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setWebviewSource((prev) => ({ uri: prev.uri }));
  }, []);

  const handleGoHome = useCallback(() => {
    router.back();
  }, [router]);

  // --- Side effects (legitimate: subscriptions + external sync) ---

  useEffect(() => {
    const url = webviewSource.uri;
    const isLocalDev =
      url.includes("localhost") || url.includes("10.0.2.2") || url.includes(".local:");
    if (url && !isLocalDev) {
      addRecentGame(url, gameName);
    }
  }, [webviewSource.uri, gameName]);

  useEffect(() => {
    const unsubscribe = subscribeToGameUrl((gameUrl) => {
      setWebviewSource({ uri: gameUrl });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    GoogleCast.showIntroductoryOverlay().catch(() => {});
  }, []);

  useEffect(() => {
    const castDevices: CastDevice[] = devices.map((d) => ({
      id: d.deviceId,
      name: d.friendlyName,
      type: "chromecast" as const,
    }));
    const current = castStore.getSnapshot().devices;
    const changed =
      castDevices.length !== current.length ||
      castDevices.some((d, i) => d.id !== current[i]?.id);
    if (changed) {
      castStore.dispatch({ type: "DEVICES_UPDATED", devices: castDevices });
    }
  }, [devices]);

  useEffect(() => {
    const sm = GoogleCast.sessionManager;
    const subs = [
      sm.onSessionStarted(() => {
        const d = castStore.getSnapshot().devices;
        if (d.length > 0) castStore.dispatch({ type: "START_CASTING", deviceId: d[0].id });
      }),
      sm.onSessionEnded(() => castStore.dispatch({ type: "STOP_CASTING" })),
      sm.onSessionResumed(() => {
        const d = castStore.getSnapshot().devices;
        if (d.length > 0) castStore.dispatch({ type: "START_CASTING", deviceId: d[0].id });
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  // --- Swipe-back gesture ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) =>
        evt.nativeEvent.pageX < EDGE_WIDTH,
      onMoveShouldSetPanResponder: (evt, gs) =>
        evt.nativeEvent.pageX < EDGE_WIDTH + 20 && gs.dx > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH, duration: 200, useNativeDriver: true,
          }).start(() => router.back());
        } else {
          Animated.spring(translateX, {
            toValue: 0, useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // --- Render ---

  if (hasError) {
    return (
      <View style={styles.container} testID="gameScreen">
        <StatusBar style="light" />
        <GameErrorScreen
          originDomain={originDomain}
          onRetry={handleRetry}
          onGoHome={handleGoHome}
        />
      </View>
    );
  }

  return (
    <BridgeContext.BridgeProvider bridge={bridge}>
      <View style={styles.container} testID="gameScreen">
        <StatusBar style="light" />
        <Animated.View
          style={[styles.fullScreen, { transform: [{ translateX }] }]}
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
                startInLoadingState={false}
                scalesPageToFit={true}
                webviewDebuggingEnabled={true}
                onLoadEnd={handleLoadEnd}
                onError={handleError}
              />
            </View>
          </CastContext.StoreProvider>

          {!isLoading && showSwipeHint && (
            <SwipeHintOverlay
              visible={showSwipeHint}
              onDismiss={dismissSwipeHint}
            />
          )}

          {isLoading && (
            <GameLoadingOverlay
              gameName={gameName}
              originDomain={originDomain}
              iconInitials={gameInfo?.iconInitials ?? gameName.substring(0, 2).toUpperCase()}
              iconColor={gameInfo?.iconColor ?? "#A855F6"}
              iconBgColor={gameInfo?.iconBgColor ?? "#2D1B69"}
            />
          )}
        </Animated.View>
      </View>
    </BridgeContext.BridgeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F" },
  fullScreen: { flex: 1 },
  webviewContainer: { flex: 1 },
  webview: { flex: 1 },
});
