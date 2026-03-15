import { by, device, element, expect, waitFor } from 'detox';
import { freshLaunchWithOnboardingDone } from './helpers';

describe('Game Screen', () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  it('should launch game and show game screen', async () => {
    // Navigate: home → game detail → game
    await element(by.id('directoryGame-trivia-jam')).tap();
    await waitFor(element(by.id('gameDetailScreen')))
      .toExist()
      .withTimeout(3000);
    await element(by.id('gameDetailPlayButton')).tap();

    // WebView loading may cause idle sync issues — disable temporarily
    await device.disableSynchronization();
    await waitFor(element(by.id('gameScreen')))
      .toExist()
      .withTimeout(15000);
    await expect(element(by.id('gameScreen'))).toExist();
    await device.enableSynchronization();
  });

  it('should navigate back from game via back button', async () => {
    // Navigate to game first
    await element(by.id('directoryGame-trivia-jam')).tap();
    await waitFor(element(by.id('gameDetailScreen')))
      .toExist()
      .withTimeout(3000);
    await element(by.id('gameDetailPlayButton')).tap();

    await device.disableSynchronization();
    await waitFor(element(by.id('gameScreen')))
      .toExist()
      .withTimeout(15000);

    // Tap back (current header-based navigation)
    await element(by.text('← Back')).tap();
    await device.enableSynchronization();

    await waitFor(element(by.id('gameDetailScreen')))
      .toExist()
      .withTimeout(5000);
  });

  // Note: "Add game to Continue list after playing" is tested in
  // continue-lifecycle.test.ts which has proper infrastructure for
  // verifying game history persistence across navigation.
});
