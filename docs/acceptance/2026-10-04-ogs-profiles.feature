# Spec: docs/product-specs/ogs-profiles.html (profiles & friends). Slice 1: profiles + sign-in.
# Replaces "Who's in your family?" and households. Friends (slice 2) and game tokens (slice 3)
# scenarios are listed at the end as @later and are not implemented yet.
# One profile per device for now (owner, 2026-10-04); profile switching comes later.
# The app signs in with email only for now (owner, 2026-10-04: "email auth through Cloudflare for
# now; we can do Google and Apple later"). The API keeps /auth/apple and /auth/google.

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

  Scenario: Next stays above the keyboard
    Given "Make your OGS profile" on an iPhone 17 Pro or an iPhone SE
    When Jonathan types his name and the keyboard is still up
    Then Next is on screen above the keyboard and makes the profile when tapped
    And Next is also there, at the bottom, once the keyboard is closed

  Scenario: The return key moves through the profile fields
    When Jonathan presses return on the name
    Then the profile id field is focused, scrolled into view above Next
    When he presses return on the profile id
    Then the profile is made, as Next would

  Scenario: Text fields stay above the keyboard
    Given Edit profile, Back up / Sign in (email, code), Join a TV and Add a friend
    When a text field is focused
    Then the field and its button (Save, Send code, Back up, Join, Add, Send) are above the keyboard

  Scenario: A kid's iPad runs the same onboarding
    Given Juneau's iPad has no profile
    When a grown-up types "Juneau" on it and taps Next
    Then Juneau has his own profile "@juneau" on that iPad
    And no sign-in was needed

  Scenario: Someone who already has a profile signs in instead of making one
    Given a fresh install
    Then the welcome offers "Make my profile" and "I already have a profile" as equal buttons
    And "Make your OGS profile" offers "Already have a profile? Sign in"
    When either one is tapped
    Then the sign-in flow opens on the email field (address, then a 6-digit code)
    And signing in with a backed-up login lands on the Library with that profile

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

  # --- Back up and sign in ---

  Scenario: Back up and sign in are email only
    When "Back up your profile" or "Sign in" opens
    Then it opens on the email field, with "We'll send a 6-digit code."
    And there are no Apple or Google buttons, and nothing "coming soon"

  Scenario: Back up with email
    Given Jonathan's profile is not backed up
    When he backs up with email (the code read from the emulated inbox)
    Then the Profile tab says "Backed up with email"

  Scenario Outline: The API verifies <provider> ID tokens (the app doesn't offer them yet)
    When a profile is backed up through POST /auth/<route> with an emulated <provider> ID token
    Then the API verifies it against the emulator and links the login

    Examples:
      | provider | route  |
      | Apple    | apple  |
      | Google   | google |

  Scenario: Email back-up uses a 6-digit code
    When Jonathan backs up with email "jonathan@example.com"
    Then a message with a 6-digit code and a sign-in link is sent to that address (Cloudflare Email Service; captured locally in tests)
    When he enters the code
    Then his profile is backed up with that email
    And a wrong code is refused, and a code stops working after 10 minutes

  Scenario: Sign in on a new phone restores the profile
    Given Jonathan backed up with email
    When the app is wiped and he signs in with the same email
    Then the app has "@jonathan.m" again, with the same name and sticker
    And the new phone has its own device token

  Scenario: A login belongs to one profile
    Given Jonathan backed up with "jonathan@example.com"
    When Mom tries to back up with the same email
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

  # Friends (slice 2) moved to 2026-10-04-ogs-friends.feature: add a friend by QR, code, link or @id;
  # friend sees Join while you cast.

  @later
  Scenario: "A friend starts a new game" push respects its switch (push deferred, owner 2026-10-04)

  @later
  Scenario: Back up and sign in with Apple or Google in the app (deferred, owner 2026-10-04)
    # App code removed in 5cf8ab40; restore from its parent. Needs prebuild for Sign in with Apple.

  # Games know who you are (slice 3) moved to 2026-10-04-games-know-you.feature. Owner Q4: a game
  # gets the profile id (not a different id per game), @id, name and avatar.
