# Exec plan: OGS profiles, slice 1 (profiles + sign-in replace households)

Spec (source of truth, owner-approved): `docs/product-specs/ogs-profiles.html`.
Acceptance: `docs/acceptance/2026-10-04-ogs-profiles.feature`.
Branch: `design/ogs-app-hillclimb`. No push, no deploy. Greenfield: household code is deleted, not
shimmed; local data may be wiped.

## Scope

In: profiles (name, unique @id, sticker), one profile per device, sign-in to back up and to restore
on a new device (Apple, Google, email code), couch
sessions owned by the caster, joining a session with the TV code, TV title
"<TV> · <host>'s games", couch = members who joined.

Out (later slices): push notifications and their switches (deferred by the owner 2026-10-04; the
future trigger is "a friend starts a new game"), friends, friend Join (slice 2); per-game game
tokens, `profile-kit`, `/.well-known/jwks.json`, game ids (slice 3); profile switching on one
device and Family (later; nothing here blocks them: identity is `{ profile, deviceToken }` for the
one active profile).

## Owner decisions applied

| Decision | Applied as |
|---|---|
| Q1 unique @id pre-filled, editable | `POST /profiles` takes an optional handle; the app pre-fills `<first name>.<initial>`; a taken handle answers 409 `handle_taken` with a free `suggestion` |
| Q2 full profile for everyone, no kids concept | No band/age column. A kid's iPad runs the same onboarding (a grown-up types the name) |
| One profile per device (coordinator, 2026-10-04) | No `POST /me/devices` pairing flow. A device gets a token by creating a profile or signing in |
| Q3 no automatic joining | A session's members are the host plus whoever joined with the TV code (friends' Join is slice 2) |
| Q6 sign-in offered, never required | Back up from onboarding's last page or the Profile tab |

## Contract (ogs-protocol)

- `ClaimsSchema`: `{ sub: profileId, did, kind: phone|tablet|launcher, sid?, exp }`; a launcher
  token must carry `sid` (its session), a phone/tablet token must not. `sub` of a launcher token is
  the host's profile id.
- Session: `SessionState.sessionId`, `hostProfileId`, `members: { profileId, name, sticker }[]`;
  `hello` carries the joining `profile` (phones/tablets); devices and roster entries carry
  `profileId` (was `personId`). Reducer rules (casts, follow, remote offer, sittings) unchanged.
- Instances: `profileId` (was `householdId`).

## API (services/api)

Tables: `profiles`, `profile_devices`, `profile_logins`, `email_codes`,
`couch_sessions`, `session_members`; `instances` keyed by `profile_id`; households tables deleted.
Routes: `POST /profiles`, `GET /profiles/handle-suggestion`, `GET/PATCH /me`, `GET/PUT /me/library`,
`GET/POST /me/instances`, `POST /sessions`, `GET /sessions/:sid`,
`POST /sessions/join`, `POST /auth/apple`, `POST /auth/google`, `POST /auth/email/start`,
`POST /auth/email/verify`, WS `/couch/ws?token=&session=`. Apple/Google ID tokens are verified
(RS256) against the issuer's discovery document + JWKS; issuers and the Resend base URL come from
env (`APPLE_ISSUER`, `GOOGLE_ISSUER`, `APPLE_CLIENT_IDS`, `GOOGLE_CLIENT_IDS`, `RESEND_BASE_URL`,
`RESEND_API_KEY`, `EMAIL_FROM`), defaults are the real providers. Tests point them at
vercel-labs/emulate.

Back up vs sign in: an auth call **with** a profile token links the login to that profile (409
`login_in_use` if another profile has it); **without** one it signs in and needs `device`
(404 `login_not_found` when no profile has that login) and answers `{ profile, token }`.

## Ownership (disjoint paths)

| Owner | Paths |
|---|---|
| Main loop | `packages/ogs-protocol/**`, `services/api/**`, `docs/**`, `scripts/emulate*` |
| TV agent | `apps/tv/**` |
| Mobile agent | `apps/mobile/**` (Profile tab, Friends and Library files only after their owners' commits land) |
| e2e (main loop, after API) | `e2e/**` |

## Test plan

1. Protocol: claims + session + instance unit tests (renamed fields; new: launcher needs `sid`,
   members on hello). Stryker `npx stryker run` in `packages/ogs-protocol` ≥ 95%.
2. API unit + `test:integration` (vitest-pool-workers): profiles/handles, /me, library, instances,
   sessions + join code, couch WS (host, member, stranger refused, launcher),
   auth with emulate (Apple + Google ID tokens minted by the emulator, email code read from the
   emulated Resend inbox). The emulator is started by the integration config's global setup on
   fixed test ports.
3. TV: unit tests for data/params/copy + Playwright `test:e2e` (title, members, join code).
4. Mobile: Jest (onboarding profile step, identity, api client, profile view),
   Detox Release (onboarding makes a profile), tester.army e2e (launcher, api, ios).
5. Cross-surface: `e2e/couch-flow.mjs` with profiles + TV code; new e2e: make profile → back up
   with email (emulated inbox) → clear app → sign in with email → same @id.
6. Gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Ports (this slice's own copies)

API 8790 · launcher 5183 · fake Chromecast 5184 · emulate 4100+ (dev) / 4200+ (integration tests).
The owner's 8788/5180/5181 stay up; 8788 is restarted on the new code at the end (schema changed).

## API contract (slice 1) — what the TV and mobile clients build against

All under `/api/v1`. Errors keep the contract `{ error: { code, message, status } }`.
`Profile = { id, handle, name, sticker }` (handle without the `@`).
`Login = { provider: "apple" | "google" | "email", email: string | null }`.
`Me = { profile: Profile, logins: Login[] }`.
`Device = { deviceId, kind: "phone" | "tablet", name }`.

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| GET | `/handles?name=<name>` or `?handle=<handle>` | none | → `{ handle, available, suggestion }` (handle normalised: lowercase `[a-z0-9._]`, 2–24; from a name: `jonathan.m` for "Jonathan Mumm", `juneau` for "Juneau"; `suggestion` = a free handle, the same one when available) |
| POST | `/profiles` | none | `{ name, handle?, sticker, device: Device }` → 201 `{ profile, token }`; 409 `handle_taken` |
| GET | `/me` | phone/tablet | → `Me` |
| PATCH | `/me` | phone/tablet | `{ name?, handle?, sticker? }` → `Me`; 409 `handle_taken` |
| GET | `/me/library` | phone/tablet/launcher (launcher: the host's) | → `{ appIds }` |
| PUT | `/me/library` | phone/tablet | `{ appIds }` → `{ appIds }` |
| GET | `/me/instances` | phone/tablet/launcher (host's) | → `Instance[]` (`profileId`) newest first |
| POST | `/me/instances` | phone/tablet | `InstanceReport & { source }` → `Instance` |
| POST | `/sessions` | phone/tablet | `{ tvName }` → 201 `{ sessionId, code, token, tvName, host: Profile }` (`token` = launcher token, 12 h; `code` = 6-char TV code) |
| GET | `/sessions/:sid` | that session's launcher, its host or a member | → `{ sessionId, code, tvName, host: Profile }` |
| POST | `/sessions/join` | phone/tablet | `{ code }` → `{ sessionId, code, tvName, host: Profile }`; 404 `session_not_found` |
| GET (WS) | `/couch/ws?token=<token>&session=<sid>` | token in query | launcher: its own session (`session` optional); phone/tablet: host or member of `session` → else 403 `not_a_member`, 404 `session_not_found`, 400 `missing_session` |
| POST | `/auth/apple`, `/auth/google` | optional phone/tablet | `{ idToken, device? }`: with a token → link (back up) → `Me`; without → sign in, `device` required → `Me & { token }`; 401 `invalid_id_token`, 409 `login_in_use`, 404 `login_not_found` |
| POST | `/auth/email/start` | none | `{ email }` → 202 `{ sent: true }` (6-digit code, 10 min, sent with Resend) |
| POST | `/auth/email/verify` | optional phone/tablet | `{ email, code, device? }` → like `/auth/apple`; 401 `invalid_code` |

Auth errors on profile routes: 401 `missing_auth` / `invalid_auth` / `invalid_token`, 404
`profile_not_found` (token for a deleted profile), 403 `profile_token_required` (a launcher token
on a phone/tablet route). The launcher URL stays `<TV_BASE>/?api=<API>&token=<launcher token>`;
the launcher reads `sid` from its token's claims (ogs-protocol `ClaimsSchema`) and fetches
`GET /sessions/:sid` for the TV name, host and code; members come from the session state.
