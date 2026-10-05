import { readPlayLink } from "@open-game-system/ogs-protocol";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { colors } from "../components/ogs/theme";
import { addDeepLinkListener, getInitialGameUrl } from "../services/deep-links";
import { setGameUrl } from "../services/game-url-store";
import {
  addPushTokenListener,
  getGameUrlFromNotification,
  initializePushNotifications,
} from "../services/notifications";
import { isOnboardingComplete } from "../services/onboarding";
import { incrementSessionCount } from "../services/session-counter";

export default function RootLayout() {
  const [ogsDeviceId, setOgsDeviceId] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    "Fraunces-Display": require("../assets/fonts/Fraunces-Display.ttf"),
  });

  // Push setup once onboarding is done (the index route decides where the app opens).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await isOnboardingComplete())) return;
      await incrementSessionCount();
      const deviceId = await initializePushNotifications();
      if (!cancelled) setOgsDeviceId(deviceId);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep link subscription (event listener).
  useEffect(() => {
    getInitialGameUrl().then((gameUrl) => {
      if (gameUrl) setGameUrl(gameUrl);
    });
    const sub = addDeepLinkListener((gameUrl) => setGameUrl(gameUrl));
    return () => sub.remove();
  }, []);

  // Push token + notification tap subscription (event listener).
  useEffect(() => {
    if (!ogsDeviceId) return;
    const tokenSub = addPushTokenListener(ogsDeviceId);
    const notificationSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = getGameUrlFromNotification(response.notification);
      // A game invite (spec §7) starts the game in that room on this couch's TV.
      const play = url ? readPlayLink(url) : null;
      if (play) router.push(`/play/${play.appId}?room=${encodeURIComponent(play.room)}`);
      else if (url) setGameUrl(url);
    });
    return () => {
      tokenSub.remove();
      notificationSub.remove();
    };
  }, [ogsDeviceId]);

  if (!fontsLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dusk0 } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" />
      {/* The game screen has its own left-edge swipe (it sends home); the native one would skip it. */}
      <Stack.Screen
        name="game"
        options={{ gestureEnabled: false, animation: "slide_from_right" }}
      />
      <Stack.Screen name="game-detail" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
      <Stack.Screen name="edit-profile" options={{ presentation: "modal" }} />
      <Stack.Screen name="invite-friends" options={{ presentation: "modal" }} />
      <Stack.Screen name="play/[appId]" />
      <Stack.Screen name="dev-tools" />
      <Stack.Screen name="[...unmatched]" />
    </Stack>
  );
}
