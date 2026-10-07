# Handoff: Trivia Jam AAA hill-climb + back into OGS

Paste the prompt below into a new Claude Code session opened in `~/src/trivia-jam`.

```
/aaa-hillclimb Trivia Jam (~/src/trivia-jam), then bring it back into the OGS app.

Context (checked 2026-10-04):
- Trivia Jam is a real-time numerical trivia party game: a host screen, and players answer from
  their phones; scoring is by accuracy and speed. Stack: TanStack Start, XState 5, Actor Kit, Tailwind +
  DaisyUI, Cloudflare Workers + Durable Objects. Live at https://triviajam.tv. Last commit was Mar 2026.
  Read AGENTS.md / CLAUDE.md first, then docs/SCREENS.md, docs/V2.md and docs/SCORING_RULES.md as needed.
- It isn't in the OGS app because the v3 Library reads the API catalogue
  (~/src/open-game-system/services/api/src/catalog.ts), which lists only the five family games
  (rocket-crew, bake-shop, story-nook, peekaboo-garden, night-flight). The old mobile
  game-directory.ts still lists it, but nothing reads it any more.
- Uncommitted work is in the repo from the old cast-kit era: package.json, the lockfile,
  src/components/host-view.tsx, and a new src/components/CastButton.tsx. OGS now manages casting
  in the app and the TV launcher, so games show no cast button. Read the diff, tell me what's
  there, and recommend whether to drop it before starting.

Skills to follow:
- /aaa-hillclimb drives the loop: an anchored scorecard; fixed evidence each round (contact sheet,
  a recorded session across several screens with real audio, phone strips, perf, an audio report);
  a fresh critic subagent each round; one owner per coupled system; keep or revert; repeat until
  every row is 8 or more, or the minimum stops rising. Its dependencies:
  /procedural-3d-web-game (references/critic-loop.md), /ai-art-assets, /verify-on-device.
- /cast-party-game, for the TV + phones shape, TV focal rules, and kid-friendly phone input
  (Juneau, 5, plays on an iPad in landscape with his thumbs at the bottom edge).
- /codex-review as an independent design judge in every round, alongside the critic subagent:
  `codex exec --skip-git-repo-check -m gpt-5.6-sol -i <contact sheet>`.
- Rocket Crew, Bake Shop and Story Nook have recently been through this loop. Use them as the
  quality bar, not as a look to copy.

Taste, from my CLAUDE.md:
- Give Trivia Jam its own art direction, not the look of the previous games.
- No faces on objects, no emoji, and nothing covering the TV's focal area.
- Never name a character "Pip"; offer me three names instead.

Bring it into OGS, after the climb or alongside it:
- Integrate @open-game-system/profile-kit the way the other games do. Vendor the tarball built
  with `pnpm pack` in ~/src/open-game-system/packages/profile-kit; see ~/src/rocket-crew's vendor/
  and src/client.
  - Use the OGS names and avatars, and skip the name form when framed by OGS.
  - Report a sitting label with reportOgsSitting.
  - Verify game tokens on the server with verifyOgsToken.
  - Silence all sound while parked with onOgsPause (see ~/src/night-flight-owls src/client/audio-pause.ts).
  - Hide the game's own room code and join UI when it's on an OGS TV: the launcher's TV code
    replaces them.
- An art kit made through ~/src/skills/ai-art-assets with Codex (codex.mjs) first, not fal: a 1:1
  icon, a 2:3 cover with the title, a transparent logo, and a 16:9 hero with no text or HUD.
  It goes in ~/src/open-game-system/apps/tv/public/art/trivia-jam/. Also a theme loop
  (theme.m4a) if the launcher's art.theme field has landed by then.
- Add the catalogue entry in services/api/src/catalog.ts with TDD, matching its tests.

Money and rules:
- Generate only through the ai-art-assets scripts (--dry first). If Codex reports "usage limit",
  stop and tell me; don't switch to fal. Never raise a cap. ElevenLabs only within its cap.
- TDD; never weaken tests. Commit at every working milestone; trivia-jam's feedback commands
  are in its AGENTS.md.
- No deploy without asking me (triviajam.tv is live, and so is the OGS API). No push without asking.
- After each round of visible changes, re-record the gameplay video and `open` it.
- Give the status of everything as committed / deployed / verified on a real device.
```
