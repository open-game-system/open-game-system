import { by, device, element, expect, waitFor } from 'detox';

describe('Onboarding — Full Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES' },
    });
    await waitFor(element(by.id('onboardingScreen')))
      .toExist()
      .withTimeout(10000);
  });

  it('should show page 1 with features and navigation', async () => {
    await expect(element(by.text('Web games, supercharged'))).toBeVisible();
    await expect(element(by.text('Notifications'))).toBeVisible();
    await expect(element(by.text('TV Casting'))).toBeVisible();
    await expect(element(by.text('Native Feel'))).toBeVisible();
    await expect(element(by.id('onboardingNextButton'))).toBeVisible();
    await expect(element(by.id('onboardingSkipButton'))).toBeVisible();
    await expect(element(by.id('pageDot-0-active'))).toExist();
  });

  it('should navigate through all 3 pages and complete via Let\'s Go', async () => {
    // Page 1 → Page 2
    await element(by.id('onboardingNextButton')).tap();
    await waitFor(element(by.text('Stay in the game')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('pageDot-1-active'))).toExist();

    // Verify page 2 content
    await expect(
      element(by.text('Turn alerts for board games'))
    ).toBeVisible();
    await expect(
      element(by.text('Game invites from friends'))
    ).toBeVisible();
    await expect(element(by.text('Live game countdowns'))).toBeVisible();
    await expect(element(by.id('onboardingSkipButton'))).toBeVisible();

    // Page 2 → Page 3 via Maybe Later
    await element(by.id('onboardingMaybeLaterButton')).tap();
    await waitFor(element(by.text("You're all set")))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('pageDot-2-active'))).toExist();
    await expect(element(by.id('onboardingLetsGoButton'))).toBeVisible();

    // Page 3 → Home
    await element(by.id('onboardingLetsGoButton')).tap();
    await waitFor(element(by.id('homeScreen')))
      .toExist()
      .withTimeout(5000);
    await expect(element(by.id('onboardingScreen'))).not.toExist();
  });

  it('should not show onboarding on relaunch after completion', async () => {
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id('homeScreen')))
      .toExist()
      .withTimeout(5000);
    await expect(element(by.id('onboardingScreen'))).not.toExist();
  });
});

describe('Onboarding — Skip Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES' },
    });
    await waitFor(element(by.id('onboardingScreen')))
      .toExist()
      .withTimeout(10000);
  });

  it('should go directly to home when tapping Skip', async () => {
    await element(by.id('onboardingSkipButton')).tap();
    await waitFor(element(by.id('homeScreen')))
      .toExist()
      .withTimeout(5000);
  });

  it('should not show onboarding on relaunch after skipping', async () => {
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id('homeScreen')))
      .toExist()
      .withTimeout(5000);
    await expect(element(by.id('onboardingScreen'))).not.toExist();
  });
});

describe('Onboarding — Enable Notifications Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES' },
    });
    await waitFor(element(by.id('onboardingScreen')))
      .toExist()
      .withTimeout(10000);
  });

  it('should advance to page 3 after enabling notifications', async () => {
    await element(by.id('onboardingNextButton')).tap();
    await waitFor(element(by.text('Stay in the game')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('onboardingEnableNotificationsButton')).tap();
    await waitFor(element(by.text("You're all set")))
      .toBeVisible()
      .withTimeout(5000);
  });
});
