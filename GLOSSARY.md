# Glossary

Domain terms used in code, specs and architecture reviews. Add a term when a module is named after it.

| Term | Meaning | Where it lives |
|---|---|---|
| **Sitting** | One in-progress play of a game (an instance): "several games of Catan going" are several sittings. A game's page lists them, each with its own Rejoin. | `apps/mobile/services/sittings.ts` |
| **Rejoin** | Opening a game back in the room it was left in (its latest URL), not a fresh room from the start page. Cast: while the couch session still holds that sitting. Phone only: while the game's return pill is up. | `apps/mobile/services/game-rejoin.ts` |
| **Return pill** | The "Rejoin" pill shown after swiping back from a game. | `apps/mobile/services/leave-game.ts` |
| **Host follow** | The couch session telling the phone that hosts a game started from the TV remote to open it. | `apps/mobile/services/couch-session.ts` |
| **Game opener** | The app module that opens a game every way it happens (a tap, the return pill, a host follow, a room join): where it plays (spec v3, Where a game plays), which URL and sitting open, and never the same game twice. | `apps/mobile/services/game-opener.ts` |
