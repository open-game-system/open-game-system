import { by, device, element, expect, waitFor } from 'detox';
import { freshLaunchWithOnboardingDone } from './helpers';

describe('App Lifecycle', () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  // --- Backgrounding / Foregrounding ---

  describe('Background and Foreground', () => {
    it('should return to home screen after backgrounding and foregrounding', async () => {
      await expect(element(by.id('homeScreen'))).toExist();

      // Background the app
      await device.sendToHome();
      // Foreground the app
      await device.launchApp({ newInstance: false });

      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(5000);
    });
  });

  // --- Force Quit ---

  describe('Force Quit', () => {
    it('should show home screen after force quit and relaunch', async () => {
      // Force quit by launching as new instance
      await device.launchApp({ newInstance: true });

      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(5000);
      // Should not show onboarding (already completed)
      await expect(element(by.id('onboardingScreen'))).not.toExist();
    });
  });

  // --- Deep Links ---
  // Note: Deep link testing in Detox requires device.openURL() which
  // sends a URL to the running app. This is complex to set up with
  // Expo's deep link handler. Documented for future implementation.

  // --- Push Notification Launch ---
  // Note: Detox can send notifications via device.sendUserNotification()
  // but this requires specific notification payload format matching
  // our notification handler. Documented for future implementation.

  // --- Offline State ---
  // Note: Testing offline state requires network condition simulation
  // which is not available in Detox iOS simulator. Would need a mock
  // server that can be toggled. Documented for future implementation.
});
