import { by, device, element, expect, waitFor } from 'detox';
import { freshLaunchWithOnboardingDone } from './helpers';

describe('Continue Lifecycle', () => {
  // --- Playing a game creates a Continue entry ---

  describe('Adding games to Continue', () => {
    beforeAll(async () => {
      await freshLaunchWithOnboardingDone();
    });

    it('should not show Continue section before playing any games', async () => {
      await expect(element(by.text('Continue'))).not.toBeVisible();
    });

    it('should add game to Continue after playing and relaunching', async () => {
      // Launch a game
      await element(by.id('directoryGame-trivia-jam')).tap();
      await waitFor(element(by.id('gameDetailScreen')))
        .toExist()
        .withTimeout(3000);
      await element(by.id('gameDetailPlayButton')).tap();

      await device.disableSynchronization();
      await waitFor(element(by.id('gameScreen')))
        .toExist()
        .withTimeout(15000);

      // Wait a moment for the game history write to complete
      await new Promise((r) => setTimeout(r, 2000));

      // Go back
      await element(by.text('← Back')).tap();
      await device.enableSynchronization();

      // Wait for navigation to settle
      await waitFor(element(by.id('gameDetailScreen')))
        .toExist()
        .withTimeout(5000);

      // Relaunch to force home screen to re-read AsyncStorage
      await device.launchApp({ newInstance: true });
      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(10000);

      // Continue section should now show Trivia Jam
      await waitFor(element(by.text('Continue')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show played game in Continue list after relaunch', async () => {
      // From previous test, Trivia Jam should be in Continue
      await expect(element(by.text('Trivia Jam'))).toBeVisible();
    });
  });

  // --- Persistence ---

  describe('Persistence', () => {
    it('should preserve Continue list across force quit', async () => {
      // Play a game to populate Continue
      await freshLaunchWithOnboardingDone();
      await element(by.id('directoryGame-trivia-jam')).tap();
      await waitFor(element(by.id('gameDetailScreen')))
        .toExist()
        .withTimeout(3000);
      await element(by.id('gameDetailPlayButton')).tap();

      await device.disableSynchronization();
      await waitFor(element(by.id('gameScreen')))
        .toExist()
        .withTimeout(15000);
      await element(by.text('← Back')).tap();
      await device.enableSynchronization();

      // Force quit and relaunch
      await device.launchApp({ newInstance: true });
      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(5000);

      // Continue should still have the game
      await waitFor(element(by.text('Continue')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  // --- Swipe to Close ---

  describe('Swipe to Close', () => {
    beforeAll(async () => {
      // Ensure we have a game in Continue
      await freshLaunchWithOnboardingDone();
      // Play Trivia Jam
      await element(by.id('directoryGame-trivia-jam')).tap();
      await waitFor(element(by.id('gameDetailScreen')))
        .toExist()
        .withTimeout(3000);
      await element(by.id('gameDetailPlayButton')).tap();
      await device.disableSynchronization();
      await waitFor(element(by.id('gameScreen')))
        .toExist()
        .withTimeout(15000);
      await element(by.text('← Back')).tap();
      await device.enableSynchronization();
      // Relaunch to see Continue
      await device.launchApp({ newInstance: true });
      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(5000);
    });

    it('should show Continue section with played game', async () => {
      await waitFor(element(by.text('Continue')))
        .toBeVisible()
        .withTimeout(5000);
    });

    // Note: Swipe-to-close gesture testing requires implementing the
    // swipeable row component first. The swipe gesture in Detox uses
    // element(by.id(...)).swipe('left'). This will be tested once the
    // SwipeableRow component is implemented.
  });
});
