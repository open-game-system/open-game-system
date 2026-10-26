# Status: BUILT (draft PR, not published) 2026-10-25.
# Design: docs/adrs/2026-10-25-create-ogs-game.md. Skill: ~/src/skills/ogs-shell-app.

Feature: From `pnpm create ogs-game` to the TV in an afternoon

  Scenario: Make a game
    When I run create-ogs-game kite-count --name "Kite Count"
    Then kite-count has the web game (Worker, Durable Object per room, TV and phone pages), app/, CI and a README
    And no __OGS_<NAME>__ placeholder is left
    And .dev.vars holds a fresh ACTOR_KIT_SECRET

  Scenario: The game plays
    Given pnpm install
    Then pnpm test passes (rules, room machine, views, routes, token check)
    And pnpm test:seam plays a round with two phones and a TV over real WebSockets

  Scenario: A preview deploy
    When I run pnpm run deploy:preview
    Then the Worker <appId>-preview is live, has an ACTOR_KIT_SECRET and its URL is in deploys.json
    And GAME_ORIGIN=<that URL> pnpm smoke plays a round against it

  Scenario: The TV on the Simulator's external display
    Given the preview deploy
    When I run pnpm e2e:ios in app/
    Then the app opens the game's /host page, I join, tap Show on TV and Apple TV / AirPlay
    And the external display shows the game's TV page, then the kites when the host starts
    And app/e2e/out has the screenshots and each step's time

  Scenario: Not a reskinned template
    When I name the game "My Game"
    Then create-ogs-game refuses it (guideline 4.3)
    When I run pnpm presubmit in app/ with the generated icon
    Then it fails until the icon, splash and 3 screenshots are the game's own
    And it reminds me to submit from my own Apple Developer account (guideline 4.2.6)
