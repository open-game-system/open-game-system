import { by, element, expect, waitFor } from 'detox';
import { freshLaunchWithOnboardingDone } from './helpers';

describe('Game Detail', () => {
  beforeEach(async () => {
    await freshLaunchWithOnboardingDone();
  });

  // --- Game Information ---

  describe('Game Information', () => {
    beforeEach(async () => {
      await element(by.id('directoryGame-trivia-jam')).tap();
      await waitFor(element(by.id('gameDetailScreen')))
        .toExist()
        .withTimeout(3000);
    });

    it('should show game detail screen with all information', async () => {
      // Back button
      await expect(element(by.id('gameDetailBackButton'))).toBeVisible();
      // Game name
      await expect(element(by.text('Trivia Jam'))).toBeVisible();
      // Origin domain
      await expect(element(by.text('by triviajam.tv'))).toBeVisible();
      // Tags
      await expect(element(by.text('Multiplayer'))).toBeVisible();
      await expect(element(by.text('Trivia'))).toBeVisible();
      // Play button
      await expect(element(by.id('gameDetailPlayButton'))).toBeVisible();
      await expect(element(by.text('Play Trivia Jam'))).toBeVisible();
    });

    it('should show OGS Features for Trivia Jam (push, cast, activity)', async () => {
      await expect(element(by.text('Push Alerts'))).toBeVisible();
      await expect(element(by.text('TV Cast'))).toBeVisible();
      await expect(element(by.text('Activity'))).toBeVisible();
    });

    it('should navigate back to home when tapping Back', async () => {
      await element(by.id('gameDetailBackButton')).tap();
      await waitFor(element(by.id('homeScreen')))
        .toExist()
        .withTimeout(3000);
    });
  });

  // --- Feature Variations ---

  describe('Feature Variations', () => {
    it('should show only Push Alerts for Block Puzzle', async () => {
      // Scroll down to find Block Puzzle in directory
      await waitFor(element(by.id('directoryGame-block-puzzle')))
        .toBeVisible()
        .whileElement(by.id('homeScrollView'))
        .scroll(200, 'down');
      await element(by.id('directoryGame-block-puzzle')).tap();
      await waitFor(element(by.id('gameDetailScreen')))
        .toExist()
        .withTimeout(3000);

      await expect(element(by.text('Push Alerts'))).toBeVisible();
      await expect(element(by.text('TV Cast'))).not.toBeVisible();
      await expect(element(by.text('Activity'))).not.toBeVisible();
    });
  });

  // --- Launch Flow ---

  describe('Launch Flow', () => {
    it('should navigate to game screen when tapping Play', async () => {
      await element(by.id('directoryGame-trivia-jam')).tap();
      await waitFor(element(by.id('gameDetailScreen')))
        .toExist()
        .withTimeout(3000);
      await element(by.id('gameDetailPlayButton')).tap();
      await waitFor(element(by.id('gameScreen')))
        .toExist()
        .withTimeout(10000);
    });
  });
});
