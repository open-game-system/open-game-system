# Quickstart for agents

A checklist a coding agent (Claude Code, Codex, Cursor…) can follow end to end to make a web game
OGS-compatible, new or existing. Each step says what to change and how to know it is done. Work
test-first and commit after each green step.

## Prompt for your agent

Copy this into your agent, in the game's repository:

```text
Make this web game OGS-compatible. Follow the step-by-step checklist at
https://ogs-docs.pages.dev/quickstart.md and treat https://ogs-docs.pages.dev/contract.md as the
contract (if the two disagree, the contract wins). APIs: https://ogs-docs.pages.dev/profile-kit.md and
https://ogs-docs.pages.dev/messages.md. Everything in one file: https://ogs-docs.pages.dev/llms-full.txt

Rules: the game never casts and shows no cast button; on an OGS TV it shows no room code, join QR or
"join at" URL; nothing covers the TV's focal area; the TV page goes silent on ogs:suspend; the game
still works in a plain browser. Work test-first: write the seam tests from
https://ogs-docs.pages.dev/testing.md before the code they cover. Tell me which steps are done,
which tests prove each one, and anything you could not verify.
```

## Before you start

You need:

- A web game with a page for the TV and a page for phones. One page can be both if it changes layout,
  but most OGS games have a separate TV page (big shared screen) and phone page (controller).
- Node 20+ and pnpm. A server is optional; you need one only to trust names and seats (step 6).
- A local clone of the OGS repo for profile-kit (step 1):
  `git clone https://github.com/open-game-system/open-game-system`.

Pick an `appId` now: lowercase letters, digits and hyphens (`[a-z0-9-]+`), for example `space-bakery`.
It names your game everywhere: the catalogue, the art folder and the `aud` of your game tokens.

## The checklist

### 1. Install profile-kit

profile-kit is not on npm yet. Build it in the OGS repo and pack a tarball into your game (it bundles
`ogs-protocol` and the app bridge; it needs `zod` and, for the hooks, `react`):

```bash
cd open-game-system
pnpm install
pnpm --filter @open-game-system/profile-kit build
cd packages/profile-kit && pnpm pack --pack-destination <your-game>/vendor
```

In your game's `package.json`:

```json
"dependencies": {
  "@open-game-system/profile-kit": "file:vendor/open-game-system-profile-kit-0.1.0.tgz"
}
```

Then `pnpm install`. After re-packing a newer build under the same file name, use
`pnpm install --force`.

**Done when** `import { onOgsPause } from "@open-game-system/profile-kit"` type-checks.

### 2. Make the TV page frameable

The launcher loads your TV page in an iframe with `allow="autoplay; fullscreen"`.

- Do not send `X-Frame-Options: DENY`/`SAMEORIGIN`, and no `Content-Security-Policy: frame-ancestors`
  that excludes the launcher.
- Start without a tap: there is no pointer on a TV. Start audio and animation on load.
- Hide any full-screen button when framed (`window.parent !== window`); the launcher already fills the TV.

**Done when** a plain HTML page with `<iframe src="YOUR_TV_URL">` shows your TV page playing.

### 3. TV page: hear the launcher

Create the session source at module load of the TV entry (the launcher posts `ogs:start` as soon as
the frame loads; profile-kit says `ogs:ready` so a missed start is re-sent).

```ts
// tv entry (module scope)
import { getOgsSessionSource, onOgsPause } from "@open-game-system/profile-kit";

getOgsSessionSource(); // start listening now
onOgsPause((paused) => audio.setPaused(paused)); // ogs:suspend → true, ogs:resume → false
```

In React, read the couch with the hook:

```tsx
import { useOgsSession } from "@open-game-system/profile-kit/react";

function TvPlayers() {
  const session = useOgsSession();
  if (session === undefined) return null; // waiting for the launcher (≤ 300 ms)
  if (session === null) return <JoinCodeAndQr />; // not on an OGS TV: keep your own join UI
  return <Seats players={session.players} />; // { id, handle, name, avatar }[]
}
```

- `ogs:start` → `session` with `players`, `token` (a game token, or `""`), `instanceId`, `mode`
  (`"continue"` or `"new"`), and `room` for multi-couch games.
- `ogs:suspend` → `onOgsPause(true)`: **go silent**. Suspend your `AudioContext`, pause every
  `<audio>`/`<video>`, stop timers that make sound. Keep the game state; the frame stays loaded.
- `ogs:resume` → `onOgsPause(false)`: resume only what was playing before.

A safe audio gate (suspends the shared context on pause, resumes it on Continue only if it was
running, and keeps a sound unlocked during the pause silent):

```ts
export function createAudioPause(getCtx: () => AudioContext | null) {
  let paused = false;
  let parked: AudioContext | null = null;
  return {
    setPaused(next: boolean) {
      if (next === paused) return;
      paused = next;
      if (paused) {
        const ctx = getCtx();
        if (ctx?.state === "running") { parked = ctx; void ctx.suspend(); }
        return;
      }
      const ctx = parked;
      parked = null;
      if (ctx?.state === "suspended") void ctx.resume();
    },
    paused: () => paused,
  };
}
```

**Done when** the seam test in [Testing](testing.md#1-the-tv-page-in-a-stand-in-launcher) passes:
every `AudioContext` is `suspended` after `ogs:suspend` and `running` after `ogs:resume`, and the TV
names the players from `ogs:start`.

### 4. TV page: no join UI inside OGS

When `useOgsSession()` (or `getOgsSessionSource().getSnapshot()`) is a session, hide your room code,
join QR, "join at" URL and cast button. OGS draws its own TV code. When it is `null` (a plain browser),
keep them: the game must still be joinable on its own.

**Done when** the framed TV page shows no code or QR after `ogs:start`, and the unframed page still does.

### 5. Phone page: use the OGS profile

```tsx
import { useOgsProfile } from "@open-game-system/profile-kit/react";

function Join() {
  const profile = useOgsProfile();
  if (profile === undefined) return <p>Joining…</p>; // asking the app (≤ 300 ms, ≤ 5 s while it fetches)
  if (profile === null) return <NameForm />; // plain browser: your own form, unchanged
  // In the OGS app: join at once under the OGS name and avatar, and send the token to your server.
  return <AutoJoin name={profile.name} avatar={profile.avatar} token={profile.token} />;
}
```

- Join **once** per seat. The app refreshes the token before it expires; a new token must not join again.
- Hide your join code entry: OGS puts the phone in the right game already.
- No React? `getOgsProfileSource()` is the same store: `getSnapshot()` and `subscribe(listener)`.

**Done when** in a fake WebView (see [Testing](testing.md#2-the-phone-page-in-a-fake-webview)) the
page joins without a form under the OGS name, and in a plain browser the form is unchanged.

### 6. Server: verify game tokens

Anything that matters (a seat, a score, a name other players see) must come from a verified token.

```ts
import { verifyOgsToken } from "@open-game-system/profile-kit/server";

const claims = await verifyOgsToken(token, { appId: "space-bakery", jwksUrl: env.OGS_JWKS_URL });
if (!claims) return joinAsGuest(); // bad signature, other game, expired, or no token: the plain-browser path
seat({ id: claims.sub, name: claims.name, avatar: claims.avatar, couch: claims.couch?.sid });
```

- It checks the ES256 signature against OGS's JWKS, `aud === appId`, and expiry; anything else is `null`.
- Make `jwksUrl` configuration (a Worker var such as `OGS_JWKS_URL`), so seam tests can serve a local
  key set. Point it at the OGS API's `/.well-known/jwks.json`.
- In the page, `readGameToken(token)` only decodes (for display). Never trust it for anything else.

**Done when** a test signs a token with a local key and your server seats that player, and rejects a
token for another `appId` and an expired one.

### 7. Report the sitting's label

```ts
import { reportOgsSitting } from "@open-game-system/profile-kit";

reportOgsSitting({ instanceId, appId: "space-bakery", status: "active", title: "Mission 6" });
```

Call it whenever the label changes, from the TV page, the phone page, or both: in the app's WebView it
goes over the app bridge, on the TV to the launcher, in a plain browser nowhere. On the TV use the
`instanceId` from `ogs:start`. `status` is one of `lobby`, `active`, `suspended`, `waiting`,
`completed`, `expired`.

**Done when** the TV seam test receives an `ogs:instance` message with your title.

### 8. Room games: declare the TV page from the phone

Skip this if your manifest has a static `tvUrl`. If each room has its own TV URL, the host's phone
page declares it while inside OGS (cast-kit, packed from the OGS repo like profile-kit):

```tsx
import { isOGSCastAvailable } from "@open-game-system/cast-kit-core";
import { CastProvider, useCastViewUrl } from "@open-game-system/cast-kit-react";

function DeclareTv({ tvUrl }: { tvUrl: string }) {
  useCastViewUrl(tvUrl); // the app forwards it to the launcher, which frames it
  return null;
}

export function HostPanel({ tvUrl }: { tvUrl: string }) {
  const inOgs = useMemo(() => isOGSCastAvailable(), []);
  return inOgs ? <CastProvider><DeclareTv tvUrl={tvUrl} /></CastProvider> : <OwnTvLinkAndQr />;
}
```

No `<CastButton>`: the app ignores a game's own cast actions.

### 9. Multi-couch rooms (optional)

Only if households in different homes should play one room together. Set `multiCouch: true` in the
manifest, call `reportOgsRoom(roomCode)` from the TV page when the room exists, join `session.room`
instead of creating a room when `ogs:start` carries one, and on the phone page join
`ogsRoomFromUrl(location.href)` when it is not `null`. Group players by `claims.couch.sid`. Details:
[the contract, §7](contract.md#7-several-couches-one-room-multicouch).

### 10. Art kit and manifest

Make the four images and write the manifest: see [Art kit and catalogue](art-and-catalogue.md). The
manifest's fields are in [Messages and manifest](messages.md#manifest).

### 11. Test it

Write the seam tests from [Testing your game](testing.md): the TV page in a stand-in launcher, the
phone page in a fake WebView, no full-screen button when framed, and the plain-browser check. Then run
the whole game end to end in a plain browser once more.

### 12. Submit to the catalogue

Open a pull request to the OGS repository with your manifest and art kit:
[Art kit and catalogue](art-and-catalogue.md#submit-to-the-catalogue).

## Done when

- The seam tests pass, and the game plays end to end in a plain browser.
- In the OGS app: no name form on phones, the TV shows the couch's names, Home silences the TV,
  Continue brings it back with sound, and Playing shows your sitting label.
- Nothing on the OGS TV shows a cast button, a room code or a join QR.
