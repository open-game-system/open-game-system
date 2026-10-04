# Exec plan: OGS profiles, slice 3 (games know who you are)

Spec (source of truth, owner-approved): `docs/product-specs/ogs-profiles.html` §3 "Games know who
you are". Builds on slice 1 (profiles, profile tokens, couch sessions) and slice 2 (friends).
Acceptance: `docs/acceptance/2026-10-04-games-know-you.feature`.
Branch: `design/ogs-app-hillclimb`. No push, no deploy (OGS or games).

## Scope

In: game tokens (ES256, one game, ~1 h), `/.well-known/jwks.json`, `POST /games/:appId/token`,
`POST /sessions/:sid/game-token`, the `profile` app-bridge store in the game WebView, `ogs:start`
carrying the session game token and players, the new `@open-game-system/profile-kit` (core, react,
server), the five family games reading it (Rocket Crew's NameGate skips itself in OGS) and reporting
a sitting label (INSTANCE_REPORT), Rocket Crew's faces removed from its stars and planet icon.

Out: pairwise per-game ids (owner Q4: games get the profile id), key rotation UI (the JWKS can list
a second key later), roster-filtered players (players = everyone on the couch), games' deploys.

## Owner decisions applied

| Decision | Applied as |
|---|---|
| Q4 a game gets profile id, @id, name, avatar | `GameToken = { iss, aud, sub, handle, name, avatar, sid?, players?, iat, exp }` and nothing else |
| Q5 no age to games | No age/band anywhere in the token or the store |
| Never: friends, other games, device ids/push tokens, the app's OGS token | The API builds the claims from the profile row only; tests assert the exact key set and that the profile token is not a game token |
| Tokens scoped to one game | `aud = appId`, 1 h; `verifyOgsToken` checks `aud`, `exp`, ES256 signature against the JWKS |
| ES256, public JWKS | Private key = Worker secret `OGS_GAME_SIGNING_KEY` (a private JWK with `kid`); JWKS = its public half |

Choices made here (spec recommendations):

- `handle` in the token is without the `@` (as everywhere in the API); games print `@` themselves.
- `avatar` = `${AVATAR_BASE_URL}/art/story-nook/char-<sticker>.webp` (the launcher serves the
  sticker art). `AVATAR_BASE_URL` is a Worker var.
- TV players = the session's host + everyone who joined (the couch), each `{ id, handle, name, avatar }`.
  The session game token's `sub`/`handle`/`name`/`avatar` are the host's, `sid` = the session.
- Unknown appId (not in the catalogue) → 404 `game_not_found`. A launcher token can't get a
  `/games/:appId/token` (403 `profile_token_required`); a phone token can't get a session one unless it
  is that session's host or member (403 `not_a_member`) — only the launcher calls it today.
- `profile` bridge store state: `{ status: "asking" } | { status: "ready", profile } | { status: "none" }`.
  The app refreshes the token 5 min before `exp`. `useOgsProfile()`: plain browser → `null`;
  WebView without a profile store after 300 ms → `null`; `asking` → `undefined` (capped at 5 s, then
  `null` so a stuck fetch shows the form); `ready` → the profile; `none` → `null`.
- The launcher re-sends `ogs:start` when a frame says `ogs:ready` (profile-kit says it when it starts
  listening), so a game whose listener attaches after the iframe's `load` still gets its start.
- Sitting labels: profile-kit `reportOgsInstance(report)` sends INSTANCE_REPORT through the app bridge
  in the WebView, and `ogs:instance` to the launcher when framed. Each game picks the label
  (room code or progress).

## Contract (ogs-protocol, additive: `src/game-token.ts`, `frame.ts`)

- `GamePlayerSchema { id, handle, name, avatar(url) }`.
- `GameTokenSchema { iss, aud, sub, handle, name, avatar, sid?, players?: GamePlayer[], iat, exp }`.
- `GAME_TOKEN_TTL_S = 3600`, `avatarUrl(base, sticker)`.
- `OgsProfileSchema { id, handle, name, avatar, token }`; `ProfileBridgeStateSchema` (above);
  `ProfileStores` type for the `profile` store.
- `ogs:start` gains `players: GamePlayer[]` (default `[]`); `token` stays a string ("" = no token).

## API (services/api)

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| GET | `/.well-known/jwks.json` | none | → `{ keys: [ { kty:"EC", crv:"P-256", x, y, kid, alg:"ES256", use:"sig" } ] }` |
| POST | `/api/v1/games/:appId/token` | phone/tablet | → `{ token, profile: OgsProfile-without-token, expiresAt }`; 404 `game_not_found` |
| POST | `/api/v1/sessions/:sid/game-token` | the session's launcher (or host/member) | `{ appId }` → `{ token, players, expiresAt }`; 404 `game_not_found` / `session_not_found`; 403 `not_a_member` |

No schema change (tokens are stateless). New env: `OGS_GAME_SIGNING_KEY` (secret, private JWK),
`AVATAR_BASE_URL` (var). Local dev: `pnpm game-key` writes a fresh key into `.dev.vars`.

## profile-kit (`packages/profile-kit`)

- `@open-game-system/profile-kit`: `createProfileSource({ bridge, timeoutMs })`,
  `createSessionSource({ win })`, `getOgsProfile`/`onOgsProfile`, `getOgsSession`/`onOgsSession`,
  `reportOgsInstance(report)`, `readGameToken(token)` (decode, unverified).
- `/react`: `useOgsProfile()`, `useOgsSession()`.
- `/server`: `verifyOgsToken(token, { appId, jwksUrl, fetch?, now? })` → `GameToken | null`.
- ogs-protocol is bundled into the dist (not on npm); `app-bridge-web` and `zod` are dependencies.
- Games consume it like cast-kit: `pnpm pack` tarball in each game's `vendor/`.

## Mobile / launcher

- `apps/mobile/app/game.tsx` sets the `profile` store; `services/game-profile.ts` fetches
  `POST /games/:appId/token` and schedules the refresh (pure, unit-tested).
- `apps/tv/src/launcher/frames.ts` `startMessage(current, grant)`; `useFrames` fetches the session
  game token (`POST /sessions/:sid/game-token`) before posting `ogs:start`, and answers `ogs:ready`.

## Games

| Game | Sitting label | Profile |
|---|---|---|
| Rocket Crew | "Mission N" (crew progress) / "Room CODE" in the lobby | NameGate skips itself; JOIN carries the token; the room verifies it and uses its name |
| Night Flight | progress / room code | name from the profile when in OGS |
| Story Nook | "Page N" / room code | name from the profile when in OGS |
| Peekaboo Garden | "Round N" / room code | name from the profile when in OGS |
| Bake Shop | "Day N" / room code | (not committed: its CLAUDE.md asks first) |

Rocket Crew also loses the faces on its collectible stars and planet icon (owner: no faces on objects).

## Test plan

1. Protocol: game-token + profile-store + frame tests; Stryker ≥ 95% for `game-token.ts`, `frame.ts`.
2. API unit (claims builder, avatar URL, JWKS from a private JWK) + integration (vitest-pool-workers):
   JWKS, game token for a known app, unknown app 404, launcher refused, token verifies against the
   JWKS, **game A's token is rejected by game B**, **the token never carries friends/age/device ids or
   the profile token**, session token with players, stranger session 403.
3. profile-kit: core sources with `createMockBridge` (app-bridge-testing) and a fake window; react hooks
   with Testing Library; `verifyOgsToken` against a locally generated ES256 key (wrong aud, expired,
   wrong key, tampered).
4. Mobile Jest: `game-profile` (fetch, refresh timing, none on failure), profile store reducer.
   TV: `startMessage` with the grant, `ogs:ready` answered.
5. Games: their own tests/typecheck; OGS seam tests in rocket-crew / night-flight-owls drive a fake
   WebView that serves the `profile` store.
6. e2e (tester.army ios): open Rocket Crew (local dev server via a catalogue override) → no "Who's
   playing here?" → joined with the profile's name.

## Ownership

| Owner | Paths |
|---|---|
| This slice | `packages/ogs-protocol/src/game-token*`, `frame*`, `index.ts`; `packages/profile-kit/**`; `services/api/src/{routes/games.ts,routes/well-known.ts,lib/game-token.ts}` + `routes/sessions.ts` (one route), `index.ts`, `types.ts`, wrangler vars, `.dev.vars.example`; `apps/mobile/app/game.tsx`, `apps/mobile/services/game-profile*`; `apps/tv/src/launcher/frames*`, `apps/tv/src/ui/useFrames.ts`; `e2e/tests/games-know-you.e2e.ts`; docs listed below |
| Others (don't touch) | `session.ts`, friends files, Playing/Library/Friends/Remote/onboarding, launcher pivot files |

## Ports (this slice's own)

API 8797 · Rocket Crew dev 8807 · simulator `slice3-s`.
