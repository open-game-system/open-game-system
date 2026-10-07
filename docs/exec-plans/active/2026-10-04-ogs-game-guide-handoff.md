# Handoff: the OGS game contract, a new /ogs-game skill, and a refresh of /cast-party-game

Paste the prompt below into a new Claude Code session in `~/src/open-game-system`.

```
Update the OGS docs for game developers so they match what we built in Oct 2026.

What is out of date (checked 2026-10-04):
- docs/specification.md was last changed in March 2026. It doesn't mention the launcher, profile-kit,
  ogs:start or the catalogue.
- ~/src/skills/cast-party-game (last changed 3 Oct) still teaches the old model:
  - cast-kit-react with a <CastButton> in the game;
  - the catalogue in apps/mobile/services/game-directory.ts, which nothing reads any more;
  - one cast per game.

Today's model:
- The phone casts once. The TV launcher (apps/tv) frames every game in one stream. People join the
  couch with the TV code, not a game's room code.

1. Rewrite docs/specification.md as "The OGS game contract", the single source of truth:
   - Manifest and catalogue: packages/ogs-protocol/src/manifest.ts and services/api/src/catalogue.ts.
     Art kit: icon 1:1, cover 2:3 with the title, transparent logo, 16:9 hero with no text.
     art.theme loop, if the theme branch has merged.
   - TV page framed by the launcher (packages/ogs-protocol/src/frame.ts):
     - ogs:ready, then ogs:start with players and a game token;
     - ogs:suspend / ogs:resume: the game must go silent (onOgsPause);
     - ogs:resume-point or reportOgsSitting for the sitting label;
     - ogs:instance.
   - Phones: the game page in the app's WebView, useOgsProfile (OGS name and avatar, skip the name
     form), the app bridge.
   - Server: verifyOgsToken; ES256 tokens with aud = appId; JWKS at /.well-known/jwks.json.
   - Rules:
     - no cast button and no room code or join UI when on an OGS TV;
     - nothing covering the TV's focal area;
     - the game is still playable in a plain browser.
   - How to test it: frame the TV page from a small parent page and post the launcher messages.
     Each game repo now has an e2e/ogs-pause seam test as an example: rocket-crew,
     night-flight-owls.
   Add an ADR and the acceptance links. Link it from AGENTS.md and docs/roadmap.md.
2. Create a new skill, ~/src/skills/ogs-game:
   - "Make a web game OGS-compatible", for a new game or an existing one such as Trivia Jam.
   - A checklist that follows the contract, links to docs/specification.md instead of copying it,
     and gives the profile-kit vendoring steps (pnpm pack → vendor/*.tgz).
   - Also cover: the art kit through /ai-art-assets, the catalogue entry with TDD, deploys
     (`pnpm run deploy`, not `pnpm deploy`), and the parked-audio gate pattern
     (see night-flight-owls src/client/audio-pause.ts).
3. Refresh /cast-party-game:
   - Keep the game design, kid input, TV focal and trailer guidance.
   - Replace its casting and directory sections with "follow /ogs-game".
   - Update references/casting.md to the launcher and the PR-5 stream path.
   Then commit and push ~/src/skills, as my CLAUDE.md says.
Sources to read: docs/lessons.md, docs/adrs/2026-10-04-tv-platforms.md, the v3 spec
(docs/product-specs/ogs-app-v3.html), packages/profile-kit/src, packages/ogs-protocol/src/frame.ts,
and docs/exec-plans/active/2026-10-04-afternoon-briefing.md.
```
