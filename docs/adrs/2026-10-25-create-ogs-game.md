# create-ogs-game composes create-ogs-app and vendors the unpublished OGS packages

- **Date:** 2026-10-25
- **Status:** Accepted

## Context

The plan is many small store apps, each a phone-and-TV game on the OGS shell. `create-ogs-app`
makes the app for a game that already exists; a new game also needs the web game itself (TV page,
phone page, a room server), CI and the path to TestFlight, "in an afternoon". The shell,
profile-kit and cast-kit are not on npm yet.

## Decision

1. **A second generator, `create-ogs-game`, that composes `create-ogs-app`** through a library
   entry (`create-ogs-app/lib`: `generateApp`, the answer schema, placeholders) and lays an overlay
   on the app it makes (`templates/app-overlay`: `cast.airplay: true`, the game's URL read from
   `deploys.json`, the simulator walk, the pre-submit check). One placeholder vocabulary
   (`__OGS_<NAME>__`) for both. create-ogs-app's own behaviour and tests are unchanged.
2. **The web game follows the cast-party-game skeleton**: one Worker, one Durable Object per room
   via actor-kit `createMachineServer`, pure rules and views, XState only for phase timers, with
   deadlines kept in state (`RESUME` after a restart, `TICK` from screens for a sleeping room).
3. **Unpublished OGS packages are vendored**: `scripts/pack-vendor.mjs` packs profile-kit,
   cast-kit and the shell with their workspace dependencies into `vendor/{game,app}` with a
   `vendor.json`; the generator copies the tarballs and writes `file:` dependencies plus
   `pnpm.overrides`. Publishing the packages later only changes these two folders.
4. **App Store guidelines 4.2.6 and 4.3 are part of the product**: the CLI refuses template names,
   the README and skill say to submit from the owner's account, and `app/ pnpm presubmit` refuses
   the generated placeholder art and missing screenshots.

## Consequences

- A generated game builds and deploys without any OGS package on npm.
- The template's starter gameplay (count the kites) is deliberately replaceable: pure modules
  under `src/game/` with tests beside them.
- The simulator walk depends on Simulator.app's menu (System Events) for the external display;
  there is no `simctl` command for it (Xcode 26.4).
