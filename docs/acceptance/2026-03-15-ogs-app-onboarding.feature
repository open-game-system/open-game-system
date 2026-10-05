# Updated 2026-10-04 for profiles slice 1 (spec docs/product-specs/ogs-profiles.html): the last
# pages are "Make your OGS profile" and a done page that offers "Back up your profile". There is no
# family step and no "You're all set" page. Skip skips the intro, never the profile: every device
# needs one (one profile per device). Detox: apps/mobile/e2e/onboarding.test.ts.
# Updated 2026-10-04 (owner: "it seems like I am being forced to register ... what if I already have
# an account?" and "how do I go back a step?"): the welcome offers two equal paths, "Make my profile"
# and "I already have a profile"; the profile step offers "Already have a profile? Sign in"; every
# page after the welcome (but the done page) has Back. The welcome says what OGS is now (cast once,
# the TV is the console) in the app's dusk palette.

Feature: OGS App Onboarding
  As a first-time OGS user
  I want to understand what OGS does and make my OGS profile
  So that I can start playing games as myself

  Background:
    Given the OGS app is freshly installed
    And this device has no OGS profile

  # --- Page 1: Welcome ---

  Scenario: First launch shows the welcome with two equal paths
    When the user launches the app for the first time
    Then the onboarding screen is displayed
    And the heading reads "Your TV is the console"
    And it says to cast once from this phone and play together on the big screen
    And a "Make my profile" button is displayed
    And an "I already have a profile" button is displayed, as a button the same size
    And a "Skip" link is displayed
    And no "Back" is displayed
    And page dots show position 1 of 4

  Scenario: Make my profile advances to page 2
    Given the user is on onboarding page 1
    And notification permission has not been asked yet
    When the user taps "Make my profile"
    Then onboarding page 2 is displayed
    And page dots show position 2 of 4

  Scenario: Notifications already granted skip page 2
    Given notification permission is already granted
    When the user taps "Make my profile" on page 1
    Then "Make your OGS profile" is displayed

  # --- Page 2: Notifications ---

  Scenario: Onboarding page 2 requests notification permission
    Given the user is on onboarding page 2
    Then the heading reads "Stay in the game"
    And three benefits are listed:
      | Turn alerts for board games  |
      | Game invites from friends    |
      | Live game countdowns         |
    And a "Turn on notifications" button is displayed
    And a "Maybe later" button is displayed

  Scenario: Tapping Turn on notifications triggers OS permission dialog
    Given the user is on onboarding page 2
    When the user taps "Turn on notifications"
    Then the iOS system notification permission dialog is presented
    When the user grants notification permission
    Then "Make your OGS profile" is displayed

  Scenario: Tapping Turn on notifications and denying still advances
    Given the user is on onboarding page 2
    When the user taps "Turn on notifications"
    And the user denies notification permission in the OS dialog
    Then "Make your OGS profile" is displayed

  Scenario: Tapping Maybe later skips permission and advances
    Given the user is on onboarding page 2
    When the user taps "Maybe later"
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
    And it shows the welcome's TV with Jonathan's sticker on the couch in front of it
    And a "Let's go" button is displayed
    And a "Back up your profile" button is displayed, with "So you can sign in on a new phone."
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
    When the user taps "I already have a profile" and signs in with a backed-up login
    Then the Library is displayed with that profile

  Scenario: The profile step offers Sign in too
    Given the user is on "Make your OGS profile"
    Then "Already have a profile? Sign in" is displayed without scrolling
    When the user types a name
    Then "Already have a profile? Sign in" is still above the keyboard
    When the user taps it and signs in with a backed-up login
    Then the Library is displayed with that profile

  Scenario: A login no profile has offers Make a profile
    When the user signs in from onboarding with a login no profile has
    Then it says "No OGS profile has that login yet." with "Make a profile"
    When the user taps "Make a profile"
    Then onboarding is displayed

  # --- Back ---

  Scenario: Back returns a step and keeps what was typed
    Given notification permission is already granted
    And the user typed "Back Kid" and picked a sticker on "Make your OGS profile"
    When the user taps "Back" (top left)
    Then the welcome is displayed
    When the user taps "Make my profile"
    Then the name still reads "Back Kid" with the same @id and sticker

  Scenario: Back from the profile step goes to page 2 when it was shown
    Given notification permission has not been asked yet
    And the user is on "Make your OGS profile"
    When the user taps "Back"
    Then onboarding page 2 is displayed

  Scenario: No Back on the done page
    Given the profile was just made
    Then no "Back" is displayed (one profile per device: there is no making it again)

  Scenario: Pages do not swipe
    Given the user is on any onboarding page
    When the user swipes sideways
    Then the page does not change (a swipe forward would pass the profile step without a profile)

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
