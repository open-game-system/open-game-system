# Several households: couches join the game's room

**Date:** 2026-10-05
**Status:** Accepted (owner-approved direction, design canvas https://claude.ai/artifact/5CoghVnLznn5pSdENvazJM)
**Builds on:** [The OGS game contract](2026-10-04-ogs-game-contract.md)

## Context

Three families want to play one Night Flight (or Trivia Jam) together, each on its own TV. OGS has one
couch session per cast (a CouchSession Durable Object), one TV launcher per couch, and "Join a friend's
cast", which sits a friend on *your* couch. There was no way for two couches to be in the same game.

Options:

1. **One big couch session** spanning households: one launcher state, one remote, one Home. Home in one
   living room would park every TV; the reducer's rules (one current game, one remote) don't fit.
2. **OGS-owned rooms** (a new "match" object above couch sessions). OGS would duplicate what every room
   game already has, and every game would have to learn a second room id.
3. **Couches join the game's room.** Each couch stays as it is; the game's own room (Night Flight's
   `KQTP`) is the meeting point. OGS carries the room id between couches and tells the game which couch
   each player sits on.

## Decision

Option 3.

- A game opts in with `multiCouch: true` in its manifest.
- The game reports its room (`ogs:room` from the TV page → `game.room` on the couch session). The sitting
  keeps it (`current.room`, paused sittings' `room`), so Continue returns to that room.
- `game.start` takes `room`; the launcher passes it in `ogs:start`, and the app adds `ogsRoom=` to the start
  page, so the game joins the room instead of creating one.
- Game tokens issued for a couch carry `couch: { sid, label }`. The label is the host's name: OGS has no
  household entity (profiles replaced households, 2026-10-04), so a couch is named by who cast it.
- Invites are a push plus a link (`opengame.org/play/<appId>?room=`); friends' presence carries the room so
  Playing can offer "Join with your couch". No new table for invites; the room lives in `session_rooms`
  next to `session_live`.
- Away handling is the game's: Home parks only that couch's frame; the game marks the couch away and keeps
  its turn order moving for the others.

## Consequences

- Couch sessions, the remote, Home and Join a friend's cast are unchanged.
- Games that never name a room behave exactly as before.
- A room id is the game's: OGS treats it as an opaque string and never verifies it exists.
- The game decides how couches play together (Night Flight: one owl per household, co-op goal).
