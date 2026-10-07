# The OGS game contract: one spec for game developers; games integrate through profile-kit, never cast

**Date:** 2026-10-04
**Status:** Accepted (owner)
**Builds on:** [TV platforms](2026-10-04-tv-platforms.md), [Cast-kit must use app-bridge](2026-03-14-cast-kit-uses-app-bridge.md)

## Context

`docs/specification.md` was last changed in March 2026 and described per-game casting, account linking
and certification. Since then the phone casts once, the TV launcher (`apps/tv`) frames every game in one
stream, people join the couch with the TV code, and games learn who is playing from game-scoped tokens
(`packages/profile-kit`). The family-game skill (`~/src/skills/cast-party-game`) still taught a cast
button in each game and the app's static game directory. Game authors had no single, current page.

## Decision

- `docs/specification.md` becomes **The OGS game contract**, the single source of truth for game
  developers: manifest and catalogue, the launcher↔TV page messages (`packages/ogs-protocol/src/frame.ts`),
  the phone page in the app WebView, server token verification, rules and how to test.
- Games integrate through **profile-kit** (`useOgsProfile`, `useOgsSession`, `onOgsPause`,
  `reportOgsSitting`, `verifyOgsToken`), vendored as a packed tarball. Room games declare their TV page
  with cast-kit-react `useCastViewUrl`; OGS forwards it as `game.view`. Games show no cast UI and no room
  code on an OGS TV, and stay playable in a plain browser.
- A parked game (`ogs:suspend`) must go silent; the launcher keeps it loaded for an instant Continue.
- The how-to for agents lives in the `ogs-game` skill (`~/src/skills/ogs-game`), which links to the spec
  instead of copying it.

## Consequences

- One place to update when the protocol changes: the schemas, then this spec, then the skill's checklist.
- The March v1 spec is retired (in git history at `c616c6b5`).
- Every catalogue game must carry the art kit (icon, cover, logo, clean hero); a catalogue test enforces it.
- Acceptance: `docs/acceptance/2026-10-04-ogs-game-contract.feature`.
