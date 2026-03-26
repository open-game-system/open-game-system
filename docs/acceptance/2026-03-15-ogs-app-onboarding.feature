Feature: OGS App Onboarding
  As a first-time OGS user
  I want to understand what OGS does and configure notifications
  So that I can start playing games with native features enabled

  Background:
    Given the OGS app is freshly installed
    And the user has never completed onboarding

  # --- Page 1: What is OGS ---

  Scenario: First launch shows onboarding page 1
    When the user launches the app for the first time
    Then the onboarding screen is displayed
    And the heading reads "Web games, supercharged"
    And three feature pillars are shown: "Notifications", "TV Casting", "Native Feel"
    And a "Next" button is displayed
    And a "Skip" link is displayed
    And page dots show position 1 of 3

  Scenario: Tapping Next advances to page 2
    Given the user is on onboarding page 1
    When the user taps "Next"
    Then onboarding page 2 is displayed
    And page dots show position 2 of 3

  # --- Page 2: Notifications ---

  Scenario: Onboarding page 2 requests notification permission
    Given the user is on onboarding page 2
    Then the heading reads "Stay in the game"
    And three benefits are listed:
      | Turn alerts for board games  |
      | Game invites from friends    |
      | Live game countdowns         |
    And an "Enable Notifications" button is displayed
    And a "Maybe Later" link is displayed

  Scenario: Tapping Enable Notifications triggers OS permission dialog
    Given the user is on onboarding page 2
    When the user taps "Enable Notifications"
    Then the iOS system notification permission dialog is presented
    When the user grants notification permission
    Then onboarding advances to page 3

  Scenario: Tapping Enable Notifications and denying still advances
    Given the user is on onboarding page 2
    When the user taps "Enable Notifications"
    And the user denies notification permission in the OS dialog
    Then onboarding advances to page 3

  Scenario: Tapping Maybe Later skips permission and advances
    Given the user is on onboarding page 2
    When the user taps "Maybe Later"
    Then onboarding advances to page 3
    And no OS notification permission dialog is shown

  # --- Page 3: Ready ---

  Scenario: Onboarding page 3 shows completion
    Given the user is on onboarding page 3
    Then the heading reads "You're all set"
    And the body text mentions swiping from the left edge
    And a "Let's Go" button is displayed
    And page dots show position 3 of 3

  Scenario: Tapping Let's Go completes onboarding and shows home
    Given the user is on onboarding page 3
    When the user taps "Let's Go"
    Then the home screen is displayed
    And onboarding is marked as completed

  # --- Skip behavior ---

  Scenario: Tapping Skip on any page goes directly to home
    Given the user is on onboarding page 1
    When the user taps "Skip"
    Then the home screen is displayed
    And onboarding is marked as completed

  Scenario: Skip is available on page 2
    Given the user is on onboarding page 2
    Then a "Skip" link is displayed

  # --- Subsequent launches ---

  Scenario: Onboarding does not show after completion
    Given the user has completed onboarding
    When the user launches the app
    Then the home screen is displayed directly
    And the onboarding screen is not shown

  Scenario: Onboarding does not show after skipping
    Given the user has skipped onboarding
    When the user launches the app
    Then the home screen is displayed directly
