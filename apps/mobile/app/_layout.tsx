import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { AppErrorBoundary } from "../components/ogs/AppErrorBoundary";
import { colors } from "../components/ogs/theme";
import { UpdateRequired } from "../components/ogs/UpdateRequired";
import { setGameUrl } from "../services/game-url-store";
import { openLink } from "../services/link-routing";
import {
  addPushTokenListener,
  getGameUrlFromNotification,
  initializePushNotifications,
} from "../services/notifications";
import { isOnboardingComplete } from "../services/onboarding";
import { appState, jsErrors } from "../services/runtime";
import { incrementSessionCount } from "../services/session-counter";
import { openUpdate, useUpdateGate } from "../services/update-check";

/** A link or a notification tap (spec §9), with what the app knows now. */
const open = (url: string, from: "link" | "push") =>
  openLink(url, from, {
    startUrls: appState.getSnapshot().catalogue.map((g) => g.startUrl),
    play: (appId, room) => router.push(`/play/${appId}?room=${encodeURIComponent(room)}`),
    game: setGameUrl,
  });

export default function RootLayout() {
  const [ogsDeviceId, setOgsDeviceId] = useState<string | null>(null);
  const updateGate = useUpdateGate();
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
    void Linking.getInitialURL().then((url) => {
      if (url) open(url, "link");
    });
    const sub = Linking.addEventListener("url", (event) => open(event.url, "link"));
    return () => sub.remove();
  }, []);

  // Push token + notification tap subscription (event listener).
  useEffect(() => {
    if (!ogsDeviceId) return;
    const tokenSub = addPushTokenListener(ogsDeviceId);
    const notificationSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = getGameUrlFromNotification(response.notification);
      if (url) open(url, "push");
    });
    return () => {
      tokenSub.remove();
      notificationSub.remove();
    };
  }, [ogsDeviceId]);

  if (!fontsLoaded) return null;

  // An older build than the latest beta: nothing else until it is updated.
  if (updateGate.kind === "update") {
    return <UpdateRequired onUpdate={() => openUpdate(updateGate.url)} />;
  }

  return (
    <AppErrorBoundary onError={(error) => jsErrors.boundary(error, "root")}>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dusk0 } }}
      >
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
    </AppErrorBoundary>
  );
}
