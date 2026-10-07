# Overnight briefing: 2026-10-06 → 2026-10-07

Everything below is **committed and pushed** (`main` = `design/ogs-app-hillclimb`) unless it says otherwise.
"Live" means deployed and smoke-checked from here. **Nothing has been verified on a real device yet**
(your phone, the iPads, the Chromecasts): that's the first thing to try.

## Try first (on the TV)

New app build is on your phone (installed over USB). Janine's link: https://i.diawi.com/SJfQiU
(installs on the 9 devices registered to your Apple team; if hers says "Unable to install", her
iPhone needs registering).

1. **Cast** a game. This is the first real cast through **production** streaming (Cloud Run
   `stream-gpu`, ~$1.40/h while casting, stops after 20 min with no phone or 3 h).
2. **Switch TVs** in "Cast to": the sheet closes on tap, the TV tab says "Switching to <TV>…",
   then names the new TV, and the TV's own header names it too. Tap another TV mid-switch: the last
   tap wins.
3. **Home** on the TV: the focused game's **theme music** plays quietly, crossfading as you move.
4. **Rocket Crew with two phones** (or a phone + an iPad): the second device follows the TV straight
   into the same room as Fixer. No QR, no room code inside OGS. Home brings both back to the remote.
5. Kids' iPads now follow the TV into games like the phones do.

## Done overnight

| Item | Status |
|---|---|
| **Docs site for game developers and their agents**: https://ogs-docs.pages.dev (quickstart with a copy-paste agent prompt, the contract generated from `docs/specification.md`, profile-kit + message references generated from the code, testing, art kit + catalogue, rules; every page also as raw Markdown; `/llms.txt`, `/llms-full.txt`). CI fails if the docs drift from the code. | live |
| **TV switching**: `tv.rename` names the new TV for every phone, the launcher header and friends; the Cast to sheet closes on tap; last tap wins; 10-switch simulator test passed 3× | API + launcher live; app on your phone |
| **Phones follow the TV**: every couch phone (and kid iPad) opens the TV's game, into the same room; Home brings them back; only the host's page picks the TV page | API live; app on your phone; e2e 15/15 (phones) and 22/23 (with iPad; only the video didn't save) |
| **Rocket Crew**: no QR/room code inside OGS; the Captain waits for the Fixer from the couch; `?ogsRoom=` puts the second device in the same room | live (`a3128497`) |
| **Theme music on Home**: five MP3 loops cut from each game's own music; Trivia Jam has none | live |
| **Join + invite design** written up: `docs/product-specs/ogs-join.html`, ADR "launcher owns joining", contract §8 (planned), roadmap; TV platform coverage ADR | docs |
| **Full-pipe stream e2e**: local renderer → WebRTC → receiver, real frames; caught and fixed a renderer bug (~1 in 3 casts failed after a warm restart) | fix live on Cloud Run (`stream-gpu-00025-488`, image `gpu15`; no instance left running) |
| **Four games backed up** to private repos: open-game-system/bake-shop, story-nook, peekaboo-garden, night-flight (Rocket Crew pushed too) | pushed |
| **SRE agent** watches the API and all five game Workers; moved to **autonomy 1** (files issues, emails you) after a quiet day | pushed |
| Retired `examples/cast-receiver` (stale March copy); `pnpm test` is fully green (47/47) | pushed |
| Trivia Jam | handled by your other session in ~/src/trivia-jam (8 hill-climb rounds; catalogue entry merged here) |

## Needs you

- **SRE agent schedule is unreliable**: GitHub fired the `*/15` cron only 4 times in ~20 h (best-effort
  schedules). The skill's own fix is a Cloudflare Worker cron that dispatches the workflow; it needs a
  GitHub token stored in that Worker, so I left it for you.
- **Two old worktrees** (`.claude/worktrees/agent-a2cd4c95`, `agent-a6ff407d`, March) hold ~260
  uncommitted files each that aren't just whitespace; I didn't delete them.
- **Retire the PR-5 preview** (`opengame-api-pr-5` + container app `codeflare-containers-pr-5`) once
  a production cast works.
- **Native crash reporting**: proposal is MetricKit (docs/agents/observability.md); nothing added.

## e2e chunk C (app / launcher / API flows)

_Filled in below when it finishes._
