# Spec: docs/product-specs/ogs-profiles.html (profiles & friends). Slice 1: profiles + sign-in.
# Replaces "Who's in your family?" and households. Friends (slice 2) and game tokens (slice 3)
# scenarios are listed at the end as @later and are not implemented yet.
# One profile per device for now (owner, 2026-10-04); profile switching comes later.

Feature: OGS profiles

  # --- Onboarding ---

  Scenario: Make your OGS profile
    Given the OGS app is opened for the first time
    When onboarding reaches "Make your OGS profile"
    Then it asks for a name, with the profile id and sticker pre-filled
    When Jonathan types "Jonathan Mumm"
    Then the profile id reads "@jonathan.m"
    And Next makes the profile and this device's token
    And the done page says "Hi, Jonathan" with "@jonathan.m"
    And it offers "Back up your profile" and "Let's go"

  Scenario: A taken @id suggests another
    Given a profile "@jonathan.m" exists
    When someone else makes a profile with the id "@jonathan.m"
    Then the app says the id is taken and offers a free one, like "@jonathan.m2"

  Scenario: The @id and sticker can be changed
    When Jonathan edits the profile id to "jonny" and picks the owl sticker
    Then the profile is made as "@jonny" with the owl

  Scenario: A kid's iPad runs the same onboarding
    Given Juneau's iPad has no profile
    When a grown-up types "Juneau" on it and taps Next
    Then Juneau has his own profile "@juneau" on that iPad
    And no sign-in was needed

  Scenario: There is no family step
    When onboarding runs
    Then it never asks "Who's in your family?"
    And nothing says "Our family"

  # --- Profile tab ---

  Scenario: The Profile tab shows the real profile
    Given Jonathan made his profile on this phone
    When he opens the Profile tab
    Then it shows his sticker, "Jonathan" and "@jonathan.m · Edit"
    And it says "Not backed up" with "Back up"

  Scenario: Edit the profile
    When Jonathan edits his name to "Jon" on the Profile tab
    Then the Profile tab shows "Jon"
    And the server has the new name

  Scenario: Notification switches are stored with the profile
    When Jonathan turns off "A friend starts casting"
    Then GET /me/notifications says friendCasting is false
    And the switch is still off after reopening the app

  # --- Back up and sign in ---

  Scenario Outline: Back up with <provider>
    Given Jonathan's profile is not backed up
    When he backs up with <provider> (emulated)
    Then the API verifies the login against the emulator
    And the Profile tab says "Backed up" with <provider>

    Examples:
      | provider |
      | Apple    |
      | Google   |
      | email    |

  Scenario: Email back-up uses a 6-digit code
    When Jonathan backs up with email "jonathan@example.com"
    Then the emulated inbox gets a message with a 6-digit code and a sign-in link
    When he enters the code
    Then his profile is backed up with that email
    And a wrong code is refused, and a code stops working after 10 minutes

  Scenario: Sign in on a new phone restores the profile
    Given Jonathan backed up with email
    When the app is wiped and he signs in with the same email
    Then the app has "@jonathan.m" again, with the same name and sticker
    And the new phone has its own device token

  Scenario: A login belongs to one profile
    Given Jonathan backed up with Google
    When Mom tries to back up with the same Google account
    Then the API refuses with login_in_use

  Scenario: Signing in with a login no profile has
    When someone signs in with an email no profile backed up with
    Then the API answers login_not_found and the app offers to make a profile

  # --- The couch ---

  Scenario: Casting starts a session owned by the caster
    When Jonathan casts to the living room TV
    Then the API makes a session with Jonathan as host and a TV code
    And the TV reads "Living room TV · Jonathan's games"
    And the TV shows Jonathan's library

  Scenario: Nobody joins automatically
    Given Jonathan is casting
    Then Mom's phone is not on the couch until she joins

  Scenario: Join with the TV code
    Given Jonathan is casting and the TV shows its code
    When Juneau's iPad joins with that code
    Then Juneau shows on the TV's couch
    And his iPad follows him into a game he is on the roster of

  Scenario: A wrong TV code is refused
    When a phone joins with a code no session has
    Then the API answers session_not_found

  Scenario: A stranger cannot open the session's socket
    Given Jonathan is casting
    When a profile that has not joined connects to the session
    Then the connection is refused with not_a_member

  # --- @later: slice 2 (friends) and slice 3 (games know who you are) ---

  @later
  Scenario: Add a friend by QR, code, link or @id

  @later
  Scenario: Friend sees Join while you cast

  @later
  Scenario: Casting push respects its switch

  @later
  Scenario: A game gets the name, no form

  @later
  Scenario: Same person, a different id in every game

  @later
  Scenario: Game A's token is rejected by game B
