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

export default function RootLayout() {
  const [ogsDeviceId, setOgsDeviceId] = useState<string | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const router = useRouter();

  // Check onboarding state
  useEffect(() => {
    isOnboardingComplete().then((complete) => {
      setNeedsOnboarding(!complete);
      setOnboardingChecked(true);
    });
  }, []);

  // Redirect to onboarding if needed (only on initial check)
  useEffect(() => {
    if (!onboardingChecked) return;

    if (needsOnboarding) {
      router.replace('/onboarding');
    }
    // Only run once after initial check — onboarding screen handles its own
    // navigation back to '/' after completion via markOnboardingComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingChecked]);

  // Initialize push notifications and get device ID
  useEffect(() => {
    initializePushNotifications().then((deviceId) => {
      setOgsDeviceId(deviceId);
    });
  }, []);

  // Handle deep links (Universal Links and custom scheme)
  useEffect(() => {
    getInitialGameUrl().then((gameUrl) => {
      if (gameUrl) {
        setGameUrl(gameUrl);
      }
    });

    const sub = addDeepLinkListener((gameUrl) => {
      setGameUrl(gameUrl);
    });

    return () => sub.remove();
  }, []);

  // Listen for push token changes and notification taps
  useEffect(() => {
    if (!ogsDeviceId) return;

    const tokenSub = addPushTokenListener(ogsDeviceId);

    const notificationSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const url = getGameUrlFromNotification(response.notification);
        if (url) {
          setGameUrl(url);
        }
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
      <Stack.Screen name="[...unmatched]" />
    </Stack>
  );
}
