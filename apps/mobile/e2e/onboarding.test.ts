import { by, device, element, expect, waitFor } from 'detox';

describe('Onboarding', () => {
  beforeEach(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true, // Fresh install state
      permissions: { notifications: 'unset' },
    });
  });

  // --- Page 1: What is OGS ---

  describe('Page 1: What is OGS', () => {
    it('should show onboarding page 1 on first launch', async () => {
      await expect(element(by.id('onboardingScreen'))).toExist();
      await expect(element(by.text('Web games, supercharged'))).toBeVisible();
      await expect(element(by.text('Notifications'))).toBeVisible();
      await expect(element(by.text('TV Casting'))).toBeVisible();
      await expect(element(by.text('Native Feel'))).toBeVisible();
      await expect(element(by.id('onboardingNextButton'))).toBeVisible();
      await expect(element(by.id('onboardingSkipButton'))).toBeVisible();
      await expect(element(by.id('pageDot-0-active'))).toExist();
      await expect(element(by.id('pageDot-1-inactive'))).toExist();
      await expect(element(by.id('pageDot-2-inactive'))).toExist();
    });

    it('should advance to page 2 when tapping Next', async () => {
      await element(by.id('onboardingNextButton')).tap();
      await waitFor(element(by.text('Stay in the game')))
        .toBeVisible()
        .withTimeout(3000);
      await expect(element(by.id('pageDot-1-active'))).toExist();
    });
  });

  // --- Page 2: Notifications ---

  describe('Page 2: Notifications', () => {
    beforeEach(async () => {
      // Navigate to page 2
      await element(by.id('onboardingNextButton')).tap();
      await waitFor(element(by.text('Stay in the game')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should show notification benefits and actions', async () => {
      await expect(element(by.text('Stay in the game'))).toBeVisible();
      await expect(
        element(by.text('Turn alerts for board games'))
      ).toBeVisible();
      await expect(
        element(by.text('Game invites from friends'))
      ).toBeVisible();
      await expect(element(by.text('Live game countdowns'))).toBeVisible();
      await expect(
        element(by.id('onboardingEnableNotificationsButton'))
      ).toBeVisible();
      await expect(
        element(by.id('onboardingMaybeLaterButton'))
      ).toBeVisible();
    });

    it('should show Skip link on page 2', async () => {
      await expect(element(by.id('onboardingSkipButton'))).toBeVisible();
    });

    it('should advance to page 3 when tapping Maybe Later', async () => {
      await element(by.id('onboardingMaybeLaterButton')).tap();
      await waitFor(element(by.text("You're all set")))
        .toBeVisible()
        .withTimeout(3000);
    });

    // Note: Testing "Enable Notifications" triggering OS dialog is difficult
    // in Detox. We test the flow with pre-granted permissions and verify
    // the app advances to page 3 after the permission flow.
    it('should advance to page 3 after enabling notifications', async () => {
      // Re-launch with notifications pre-granted to simulate the flow
      await device.launchApp({
        newInstance: true,
        delete: true,
        permissions: { notifications: 'YES' },
      });
      await element(by.id('onboardingNextButton')).tap();
      await waitFor(element(by.text('Stay in the game')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('onboardingEnableNotificationsButton')).tap();
      await waitFor(element(by.text("You're all set")))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  // --- Page 3: Ready ---

  describe('Page 3: Ready', () => {
    beforeEach(async () => {
      // Navigate to page 3 via Maybe Later
      await element(by.id('onboardingNextButton')).tap();
      await waitFor(element(by.text('Stay in the game')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('onboardingMaybeLaterButton')).tap();
      await waitFor(element(by.text("You're all set")))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should show completion content', async () => {
      await expect(element(by.text("You're all set"))).toBeVisible();
      await expect(element(by.id('onboardingLetsGoButton'))).toBeVisible();
      await expect(element(by.id('pageDot-2-active'))).toExist();
    });

    it('should show home screen when tapping Let\'s Go', async () => {
      await element(by.id('onboardingLetsGoButton')).tap();
      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(3000);
      await expect(element(by.id('onboardingScreen'))).not.toExist();
    });
  });

  // --- Skip behavior ---

  describe('Skip behavior', () => {
    it('should go directly to home when tapping Skip on page 1', async () => {
      await element(by.id('onboardingSkipButton')).tap();
      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(3000);
    });
  });

  // --- Subsequent launches ---

  describe('Subsequent launches', () => {
    it('should not show onboarding after completion via Let\'s Go', async () => {
      // Complete onboarding
      await element(by.id('onboardingNextButton')).tap();
      await waitFor(element(by.text('Stay in the game')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('onboardingMaybeLaterButton')).tap();
      await waitFor(element(by.text("You're all set")))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('onboardingLetsGoButton')).tap();
      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(3000);

      // Relaunch
      await device.launchApp({ newInstance: true });
      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(5000);
      await expect(element(by.id('onboardingScreen'))).not.toExist();
    });

    it('should not show onboarding after skipping', async () => {
      // Skip onboarding
      await element(by.id('onboardingSkipButton')).tap();
      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(3000);

      // Relaunch
      await device.launchApp({ newInstance: true });
      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(5000);
      await expect(element(by.id('onboardingScreen'))).not.toExist();
    });
  });
});
