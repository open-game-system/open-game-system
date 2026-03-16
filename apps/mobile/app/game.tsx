import {
  BridgedWebView,
  createNativeBridgeContext,
  createNativeBridge,
  NativeBridge,
} from "@open-game-system/app-bridge-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { findGameByUrl } from "../services/game-directory";

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

  // Derive webview source from params or pending URL — no useEffect sync needed
  const initialSource = useMemo(() => {
    if (params.url) return { uri: params.url };
    const pending = consumePendingGameUrl();
    if (pending) return { uri: pending };
    return defaultSource;
  }, [params.url, defaultSource]);

  const [webviewSource, setWebviewSource] = useState(initialSource);

  // Only update when initialSource changes (new params arrive)
  const prevInitialUri = useRef(initialSource.uri);
  if (initialSource.uri !== prevInitialUri.current) {
    prevInitialUri.current = initialSource.uri;
    setWebviewSource(initialSource);
  }

  const gameName = params.name || "Game";
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const gameInfo = useMemo(() => findGameByUrl(webviewSource.uri), [webviewSource.uri]);
  const originDomain = useMemo(() => {
    try { return new URL(webviewSource.uri).hostname; }
    catch { return webviewSource.uri; }
  }, [webviewSource.uri]);

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
    // Force a re-render of the WebView by creating a new source object
    setWebviewSource((prev) => ({ uri: prev.uri }));
  }, []);

  const handleGoHome = useCallback(() => {
    router.back();
  }, [router]);

  // Track URL changes within the WebView and update game history
  const handleNavigationStateChange = useCallback(
    (navState: { url?: string; title?: string }) => {
      if (navState.url && navState.url !== webviewSource.uri) {
        const isLocalDev =
          navState.url.includes("localhost") ||
          navState.url.includes("10.0.2.2") ||
          navState.url.includes(".local:");
        if (!isLocalDev) {
          const title = navState.title || gameName;
          addRecentGame(navState.url, title);
        }
      }
    },
    [webviewSource.uri, gameName]
  );

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

  // Error screen
  if (hasError) {
    return (
      <View style={styles.container} testID="gameScreen">
        <StatusBar style="light" />
        <View style={styles.errorContainer} testID="gameErrorScreen">
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>
          <Text style={styles.errorTitle}>Couldn't load game</Text>
          <Text style={styles.errorMessage}>
            {originDomain} isn't responding. Check your connection and try again.
          </Text>
          <TouchableOpacity
            testID="gameRetryButton"
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="gameGoHomeButton"
            style={styles.goHomeButton}
            onPress={handleGoHome}
          >
            <Text style={styles.goHomeText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
                startInLoadingState={false}
                scalesPageToFit={true}
                webviewDebuggingEnabled={true}
                onLoadEnd={handleLoadEnd}
                onError={handleError}
                // onNavigationStateChange={handleNavigationStateChange}  // TODO: enable when URL tracking is properly tested
              />
            </View>
          </CastContext.StoreProvider>

          {/* Loading overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay} testID="gameLoadingScreen">
              <View
                style={[
                  styles.loadingIcon,
                  { backgroundColor: gameInfo?.iconBgColor ?? '#2D1B69' },
                ]}
              >
                <Text
                  style={[
                    styles.loadingIconText,
                    { color: gameInfo?.iconColor ?? '#A855F6' },
                  ]}
                >
                  {gameInfo?.iconInitials ?? gameName.substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.loadingTitle}>Loading {gameName}</Text>
              <Text style={styles.loadingDomain}>{originDomain}</Text>
              <ActivityIndicator
                color="#A855F6"
                style={styles.loadingSpinner}
              />
            </View>
          )}
        </Animated.View>
      </View>
    </BridgeContext.BridgeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0F",
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
  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0A0F",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  loadingIconText: {
    fontSize: 28,
    fontWeight: "700",
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#E8E8ED",
    letterSpacing: -0.3,
  },
  loadingDomain: {
    fontSize: 14,
    color: "#8888A0",
  },
  loadingSpinner: {
    marginTop: 16,
  },
  // Error screen
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  errorIconText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#DC2626",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#E8E8ED",
    letterSpacing: -0.3,
  },
  errorMessage: {
    fontSize: 14,
    color: "#8888A0",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#A855F6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  goHomeButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  goHomeText: {
    color: "#8888A0",
    fontSize: 15,
    fontWeight: "500",
  },
});
