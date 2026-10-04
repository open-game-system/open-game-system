# Updated 2026-10-04 for profiles slice 1 (spec docs/product-specs/ogs-profiles.html): the last
# pages are "Make your OGS profile" and a done page that offers "Back up your profile". There is no
# family step and no "You're all set" page. Skip skips the intro, never the profile: every device
# needs one (one profile per device). Detox: apps/mobile/e2e/onboarding.test.ts.

Feature: OGS App Onboarding
  As a first-time OGS user
  I want to understand what OGS does and make my OGS profile
  So that I can start playing games as myself

  Background:
    Given the OGS app is freshly installed
    And this device has no OGS profile

  # --- Page 1: What is OGS ---

  Scenario: First launch shows onboarding page 1
    When the user launches the app for the first time
    Then the onboarding screen is displayed
    And the heading reads "Web games, supercharged"
    And three feature pillars are shown: "Notifications", "TV Casting", "Native Feel"
    And a "Next" button is displayed
    And a "Skip" link is displayed
    And "I already have a profile — sign in" is displayed
    And page dots show position 1 of 4

  Scenario: Tapping Next advances to page 2
    Given the user is on onboarding page 1
    And notification permission has not been asked yet
    When the user taps "Next"
    Then onboarding page 2 is displayed
    And page dots show position 2 of 4

  Scenario: Notifications already granted skip page 2
    Given notification permission is already granted
    When the user taps "Next" on page 1
    Then "Make your OGS profile" is displayed

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
    Then "Make your OGS profile" is displayed

  Scenario: Tapping Enable Notifications and denying still advances
    Given the user is on onboarding page 2
    When the user taps "Enable Notifications"
    And the user denies notification permission in the OS dialog
    Then "Make your OGS profile" is displayed

  Scenario: Tapping Maybe Later skips permission and advances
    Given the user is on onboarding page 2
    When the user taps "Maybe Later"
    Then "Make your OGS profile" is displayed
    And no OS notification permission dialog is shown

  # --- Page 3: Make your OGS profile ---

  Scenario: The profile page asks for a name with the @id and sticker pre-filled
    Given the user is on "Make your OGS profile"
    Then it asks for a name
    And a sticker is already picked and can be changed
    When the user types "Jonathan Mumm"
    Then the profile id reads "@jonathan.m" and says it is free
    And page dots show position 3 of 4

  Scenario: A taken @id offers a free one
    Given "@jonathan.m" is taken
    When the user types "Jonathan Mumm"
    Then the profile id says "taken" and offers a free one, like "@jonathan.m2"

  Scenario: Next makes the profile
    Given the user typed a name on "Make your OGS profile"
    When the user taps "Next"
    Then the profile and this device's token are made
    And the done page is displayed

  Scenario: The profile page says what went wrong in words
    Given OGS cannot be reached
    When the user taps "Next" on "Make your OGS profile"
    Then it says "Can't reach OGS. Check your Wi-Fi and try again." with Try again
    And no status code is shown

  # --- Page 4: Done ---

  Scenario: The done page greets and offers Back up
    Given the profile "Jonathan Mumm" "@jonathan.m" was just made
    Then the done page says "Hi, Jonathan" with "@jonathan.m"
    And a "Let's go" button is displayed
    And a "Back up your profile" button is displayed
    And page dots show position 4 of 4

  Scenario: Back up from the done page
    Given the user is on the done page
    When the user taps "Back up your profile" and continues with email and its 6-digit code
    Then the done page says "Backed up with email"

  Scenario: Tapping Let's go completes onboarding and shows the Library
    Given the user is on the done page
    When the user taps "Let's go"
    Then the Library is displayed
    And onboarding is marked as completed

  # --- Skip and sign in ---

  Scenario: Skip goes to the profile page, not past it
    Given the user is on onboarding page 1
    When the user taps "Skip"
    Then "Make your OGS profile" is displayed

  Scenario: Skip is available on page 2
    Given the user is on onboarding page 2
    Then a "Skip" link is displayed

  Scenario: Skip is gone from the profile page on
    Given the user is on "Make your OGS profile"
    Then no "Skip" link is displayed

  Scenario: Signing in to an existing profile skips making one
    Given the user is on onboarding page 1
    When the user taps "I already have a profile — sign in" and signs in with a backed-up login
    Then the Library is displayed with that profile

  Scenario: There is no family step
    When onboarding runs
    Then it never asks "Who's in your family?"

  # --- Subsequent launches ---

  Scenario: Onboarding does not show after completion
    Given the user has completed onboarding
    When the user launches the app
    Then the home screen is displayed directly
    And the onboarding screen is not shown

  Scenario: Deleting and reinstalling the app starts onboarding again
    Given the user had a profile on this device
    When the app is deleted and installed again
    Then onboarding is displayed
    And the old profile can come back only by signing in
