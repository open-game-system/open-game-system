import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import {
  initializePushNotifications,
  addPushTokenListener,
  getGameUrlFromNotification,
} from "../services/notifications";
import {
  getInitialGameUrl,
  addDeepLinkListener,
} from "../services/deep-links";
import { setGameUrl } from "../services/game-url-store";
import { isOnboardingComplete } from "../services/onboarding";
import { incrementSessionCount } from "../services/session-counter";

export default function RootLayout() {
  const [ogsDeviceId, setOgsDeviceId] = useState<string | null>(null);
  const router = useRouter();

  // App initialization: check onboarding → redirect or init push
  // Single effect replaces three chained effects (/dont-use-use-effect)
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const complete = await isOnboardingComplete();
      if (cancelled) return;

      if (!complete) {
        router.replace("/onboarding");
        return;
      }

      // Onboarding done — increment session counter and init push
      await incrementSessionCount();
      const deviceId = await initializePushNotifications();
      if (cancelled) return;
      setOgsDeviceId(deviceId);
    };
    init();
    return () => { cancelled = true; };
  }, [router]);

  // Deep link subscription (event listener — legitimate useEffect)
  useEffect(() => {
    getInitialGameUrl().then((gameUrl) => {
      if (gameUrl) setGameUrl(gameUrl);
    });

    const sub = addDeepLinkListener((gameUrl) => {
      setGameUrl(gameUrl);
    });
    return () => sub.remove();
  }, []);

  // Push token + notification tap subscription (event listener — legitimate useEffect)
  useEffect(() => {
    if (!ogsDeviceId) return;

    const tokenSub = addPushTokenListener(ogsDeviceId);
    const notificationSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const url = getGameUrlFromNotification(response.notification);
        if (url) setGameUrl(url);
      });

    return () => {
      tokenSub.remove();
      notificationSub.remove();
    };
  }, [ogsDeviceId]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="index" />
      <Stack.Screen name="game-detail" />
      <Stack.Screen name="game" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="dev-tools" />
      <Stack.Screen name="[...unmatched]" />
    </Stack>
  );
}
