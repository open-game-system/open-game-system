# Exec plan: OGS profiles, slice 2 (friends)

Spec (source of truth, owner-approved): `docs/product-specs/ogs-profiles.html` (§2 Friends & Profile,
§2 The couch). Builds on slice 1 (`2026-10-04-profiles-slice-1.md`): profiles, profile tokens, couch
sessions owned by the caster, join with the TV code.
Acceptance: `docs/acceptance/2026-10-04-ogs-friends.feature`.
Branch: `design/ogs-app-hillclimb`. No push, no deploy.

## Scope

In: mutual friends (request → accept), adding a friend by **QR, short code, invite link or @id**, the
friends list with presence (online / casting on <TV> / playing <game> / last seen), requests with
Accept / Decline, removing a friend, the friends' casts you may join (Join card on top of Playing),
joining a friend's session without the TV code.

Out: push notifications (later trigger: "a friend starts a new game"), Family, profile switching,
blocking/reporting, game tokens (slice 3).

## Owner decisions applied

| Decision | Applied as |
|---|---|
| Friends are mutual | A friendship row exists only after the other side accepts (or both asked each other) |
| Add by QR, code, link or @id | One invite = a short code (`KITE-42`, 10 min), a link token and a QR token; `POST /friends/requests {handle}` for @id |
| "Both sides confirm; a scan in person accepts at once" (spec) | Redeeming the **QR** token makes you friends at once. The code and the link make a pending request the inviter accepts |
| No automatic joining | A friend's live cast is offered as a Join card; joining is a tap. Anyone else uses the TV code |
| No pushes yet | Nothing is sent; Friends and Playing poll |
| Friends see name, sticker, @id, presence | `Friend = PublicProfile & { presence, since }`; nothing else about a friend leaves the API |

Choices made here (the spec's recommendation, where it had one):

- An invite is **single use**: the first redeem of any of its three secrets consumes it. Opening Add a
  friend again makes a new one. Expired or used: 410 `invite_expired` / `invite_used`.
- Asking someone who already asked you accepts their request (both sides confirmed).
- Either side may withdraw a pending request (`decline` by the recipient, or by the sender = cancel).
- Removing a friend is silent and mutual (the row goes); it does not leave any session already joined.
- Presence "online" = a phone/tablet request in the last 5 minutes. "Casting" = the host of a session
  whose TV launcher is connected. "Playing" = in a live session (host or member) running a game.
  Casting wins over playing (a host casting a game shows `casting` with the game).

## Contract (ogs-protocol, additive: `src/friends.ts`)

- `PublicProfileSchema { id, handle, name, sticker }` — what a friend sees.
- `GameRefSchema { appId, name }`.
- `PresenceSchema` (discriminated on `kind`): `casting { sessionId, tvName, game | null }`,
  `playing { sessionId, tvName, game }`, `online`, `offline { lastSeenAt | null }`.
- `FriendSchema = PublicProfile & { presence, since }` (since: ms).
- `FriendRequestSchema { id, from, to, via: code|link|handle, createdAt }`;
  `FriendRequestsSchema { incoming, outgoing }`.
- `FriendInviteSchema { code, link, qr, expiresAt }` (`code` displayed `KITE-42`).
- `RedeemInviteSchema { code } | { token }`, `AddFriendSchema { handle }`.
- `FriendOutcomeSchema`: `{ status: "friends", friend }` | `{ status: "requested", request }`.
- `CastingFriendSchema { sessionId, tvName, host, game | null, joined }`.
- Pure: `normaliseInviteCode`, `formatInviteCode`, `inviteTokenFromUrl` (link or QR URL → token),
  `derivePresence`, `comparePresence` / `sortFriends`, `ONLINE_WINDOW_MS`, `INVITE_TTL_MS`.

## API (services/api)

New tables (additive, `CREATE TABLE IF NOT EXISTS`, so the shared local DB only needs the schema
re-applied, no wipe): `friendships(profile_a, profile_b, created_at)` with `profile_a < profile_b`;
`friend_requests(id, from_profile_id, to_profile_id, via, created_at, UNIQUE(from,to))`;
`friend_invites(id, profile_id, code UNIQUE, link_token UNIQUE, qr_token UNIQUE, expires_at, used_at,
used_by)`; `profile_seen(profile_id, last_seen_at)`; `session_live(session_id, app_id, since)` (a row
while the session's TV launcher is connected, written by the CouchSession DO).

All under `/api/v1`, phone/tablet token (a launcher token: 403 `profile_token_required`).

| Method | Path | Body → Response |
|---|---|---|
| POST | `/friends/invites` | → 201 `FriendInvite` (`link` = `<INVITE_BASE_URL>/<linkToken>`, `qr` = `<INVITE_BASE_URL>/<qrToken>`, default base `https://opengame.org/add`) |
| POST | `/friends/invites/redeem` | `{ code }` or `{ token }` → QR token: 200 `{ status: "friends", friend }`; code/link: 201 `{ status: "requested", request }`. 404 `invite_not_found`, 410 `invite_expired` / `invite_used`, 409 `cannot_friend_self` |
| POST | `/friends/requests` | `{ handle }` (with or without `@`) → 201 requested, or 200 friends when they had asked you; 404 `handle_not_found`, 409 `cannot_friend_self` / `already_friends` |
| GET | `/friends/requests` | → `{ incoming, outgoing }` newest first |
| POST | `/friends/requests/:id/accept` | recipient only → 200 `{ status: "friends", friend }`; 404 `request_not_found` |
| POST | `/friends/requests/:id/decline` | recipient or sender → 204; 404 `request_not_found` |
| GET | `/friends` | → `Friend[]` (casting, playing, online, offline; then name) |
| DELETE | `/friends/:profileId` | → 204; 404 `friend_not_found` |
| GET | `/friends/casting` | → `CastingFriend[]`: friends hosting a live session, newest cast first |
| POST | `/sessions/:sid/join` | → session view (as `/sessions/join`); the host's friends only: 403 `not_a_friend`, 404 `session_not_found` |

Last seen: `anyToken` records phone/tablet requests (at most one write a minute) and so does the
couch WebSocket. Live: `CouchSession` writes `session_live` when `state.cast` or the current game
changes.

## Mobile (Phase B, after the slice-1 mobile finisher lands)

Owned: `app/(tabs)/friends.tsx`, `app/friends/*` (Add a friend, Find by @id), `components/ogs/friends/**`,
`services/friends*.ts`. Friends tab: requests on top (Accept / Decline), then friends with presence; a
casting friend shows Join. Add a friend: my QR (react-native-qrcode-svg if installable, else the code
large), the code, Share invite link, Scan their code (expo-camera when present; else type the code),
Find by @id. Join card: `components/ogs/friends/FriendCastingCard.tsx` + `useFriendCasts` hook;
`app/(tabs)/playing.tsx` integration only after the Playing hill-climb lands.

## Test plan

1. Protocol: schema + pure-function unit tests (`src/friends.test.ts`); Stryker ≥ 95%.
2. API `test:integration` (vitest-pool-workers, real D1 + DO): `friends.test.ts` (invites, redeem by
   code/link/QR, single use, expiry, self, requests by handle, accept/decline/cancel, list, remove,
   mutual-ask auto-accept, auth), `friends-presence.test.ts` (online window, casting via a real
   launcher WebSocket, playing via `game.start`, offline after the launcher leaves,
   `/friends/casting`, `POST /sessions/:sid/join` friend vs stranger, then the couch WebSocket).
3. tester.army api: two profiles befriend each other by code, one casts, the other joins.
4. Mobile (Phase B): Jest for services/friends + components; Detox Release on own sim `friends-s2`
   with a second profile made through the API.
5. Gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `test:integration`, Stryker (protocol).

## Ports

Own API copy on 8796 with its own local D1 (`--persist-to .wrangler/friends-s2`); the shared 8788 is
not restarted. The new tables need `pnpm --filter @open-game-system/api db:local` (additive).

## Ownership

| Owner | Paths |
|---|---|
| Friends agent (this plan) | `packages/ogs-protocol/src/friends*.ts`, `services/api/src/routes/friends.ts`, `services/api/src/lib/friends*.ts`, `services/api/src/lib/presence.ts`, friends tests, `schema.sql` (append), `docs/**` friends files, mobile files above |
| Shared touch points (small, additive) | `services/api/src/index.ts` (mount), `routes/sessions.ts` (`/:sid/join`), `middleware/profile-auth.ts` (last seen), `couch-session.ts` (live), `routes/couch.ts` (last seen) |
| Playing agent | `app/(tabs)/playing.tsx` |
