# Handoff: several households play one game (multi-couch), prototyped with Night Flight

Paste the prompt below into a new Claude Code session opened in `~/src/open-game-system`.

```
Build "several households play one game" in OGS and prove it end to end with Night Flight. Finish with a
recorded e2e run in which three couches join the same room.

Design (owner-approved direction, 2026-10-05):
- The design canvas is https://claude.ai/artifact/5CoghVnLznn5pSdENvazJM. Read its Sequence board with
  the Artifact tool (action "read", path project/Sequence.dc.html).
- Each living room keeps its own couch (CouchSession DO), TV launcher and phones. The couches join the
  game's room; the game groups players by couch.
- The flow:
  1. The Mumms start Night Flight, and the game creates room R.
  2. A Mumm phone taps "Invite friends to this game" → OGS sends a push and the link
     opengame.org/play/<appId>?room=R.
  3. The Smiths tap it: cast prompt if needed, then game.start into room R on their TV.
  4. The Parks join from a Playing-tab card: "Mumms and Smiths are playing…", with "Join with your couch".
  5. Every TV shows room R.
  6. Home on one TV parks only that TV; Continue brings it back into room R.
  7. Each couch keeps a "Room R" sitting.

Read first: AGENTS.md, docs/specification.md (the OGS game contract), docs/lessons.md,
docs/testing/e2e.md, packages/ogs-protocol/src/session.ts, game-token.ts and frame.ts,
services/api (CouchSession, sessions routes, friends routes), and apps/mobile (Playing tab, game page).
Then load the /ogs-game skill for the Night Flight work. Night Flight lives in ~/src/night-flight-owls,
with appId night-flight.

1. OGS. Spec and acceptance first: add a v3 spec section and
   docs/acceptance/2026-10-05-multi-couch.feature, with an index row and an ADR for the couch-to-room
   model. Then TDD:
   - The game token carries the couch (a `couch` claim: the session id plus a household label). Update
     profile-kit's verifyOgsToken types and the docs.
   - The manifest gets an optional flag for games that accept several couches (e.g. `multiCouch: true`).
   - game.start accepts the game's room (e.g. `room`), and the launcher passes it to the game in
     ogs:start so the game joins that room instead of creating one.
   - An invite API: POST invites to friends (push through the existing provider stubs; a link is fine).
   - A /play/<appId>?room= deep link in the app, with a web fallback page in apps/web.
   - Friends' presence shows the game and room, so the Playing tab can show "Join with your couch".
   - Check what today's "Join a friend's cast" does, and don't break it.
2. Night Flight. TDD in its repo:
   - Accept players from several couches in one room.
   - Group them by couch. Recommended: each household is its own owl or nest, and its players' cards
     move it. Keep the co-op goal.
   - Show every household's players on every TV.
   - A couch leaving or parking marks them away without stalling the turn order.
   - Keep single-couch play exactly as it is today.
   - Bump the vendored profile-kit.
3. E2E and video. Add the test to e2e/ (see docs/testing/e2e.md).
   - A local API (wrangler dev) and a local Night Flight.
   - Three launchers, each in its own Playwright context with its own couch.
   - The Mumm phone in the iOS simulator under Detox, tapping Invite. The Smith and Park phones are
     scripted couch clients, like e2e/couch-flow.mjs.
   - Assert:
     - all three TVs show room R;
     - the game sees three couches;
     - a card played on a Smith phone moves the board on all three TVs;
     - Home on the Smith TV parks only that TV, and Continue resumes it in room R.
   - Record each context (Playwright recordVideo) and the simulator, then use ffmpeg to put them in one
     synced 2×2 video. Save it under docs/exec-plans/active/evidence/2026-10-05-multi-couch/ and `open` it.
   - Everything renders locally: no Cloud Run, no GPU, no SFU.

Rules:
- TDD, never weaken tests, and commit at every working milestone with `git commit -o <paths>`.
- Gates: `pnpm typecheck && pnpm lint && pnpm test` (the examples/cast-receiver failures are already known).
- Update the docs AGENTS.md lists: spec, acceptance, architecture endpoint table, schema.sql if D1
  changes, lessons, roadmap.
- Use pnpm only.
- No push and no deploy without asking me. Night Flight deploys with `pnpm run deploy`, not `pnpm deploy`.
- Don't touch apps/mobile/ios or apps/mobile/android.
- Never print secrets.
- Report status as committed / deployed / verified on a real device.
```

## Also open from 2026-10-04 (not part of this handoff)
- Home theme music: worktree `.claude/worktrees/agent-a3ce82b0b3ec4cd42`. The m4a→mp3 conversion is
  uncommitted. Finish it, verify, merge. See `~/.claude/handoffs/open-game-system/2026-10-04-e2e/resume.md`.
- e2e sweep chunk B (local full pipe) restarts from the brief; chunk C hasn't started.
- Reproduce the owner's report that "the Home button doesn't take me to the launcher Home".
