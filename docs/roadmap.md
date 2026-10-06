# OGS roadmap

Owner-decided direction as of 2026-10-04. Detail lives in the linked specs and ADRs; this page is the order of work.
Statuses: **Done** (committed and verified locally) · **Next** · **Later** · **Not planned**.

## The product today (Done, on `design/ogs-app-hillclimb`; API, launcher and games deployed 2026-10-04)

- Cast once; the TV launcher frames each game in one stream; swap without recasting; swipe back = Home; Rejoin returns to the same room. Spec: `product-specs/ogs-app-v3.html`.
- Five tabs: Playing · TV · Library · Friends · Profile. Library = All Games (covers) → game page with sittings + Start game.
- Profiles (one per device): "Make your OGS profile", @id, back up / sign in with email (6-digit code, Cloudflare Email Service). Spec: `product-specs/ogs-profiles.html`.
- Friends: add by QR, code, link or @id; requests; presence; Join a friend's cast.
- Games know you: game-scoped ES256 tokens, `profile-kit`; Rocket Crew skips its name form; every game reports a sitting label.
- Art kit per game; PS5-style TV launcher; redesigned remote, Playing, Library.
- **Several households play one game** (2026-10-05, local; not deployed): `multiCouch` games; couches join the game's room; invites (push + `opengame.org/play/<appId>?room=`), Join with your couch on Playing, game tokens name the couch; Night Flight gives each household its own owl. Spec §7, [ADR](adrs/2026-10-05-couches-join-the-games-room.md), e2e `e2e/multi-couch.mjs`.

## Next: make it real for the family

1. **Test on real devices:** API (`opengame-api.jonathanrmumm.workers.dev`), launcher (`ogs-tv.pages.dev`) and the five games are deployed. Still to do: the app on your phone and the kids' iPads (needs Xcode signed in), real Chromecast casting (stream server wiring), custom domains (`api.opengame.org`, `tv.opengame.org`).
2. **Owner setup:** regenerate the iOS project (`expo prebuild -p ios` + `pod install`) so it drops the Sign in with Apple entitlement; Cloudflare Email Sending on opengame.org.
3. **Open decisions:** holder placement on the remote; react-native-svg for a physical pad. (Decided: Rejoin pill only on TV/Friends/Profile; Start game is the game page's filled button.)
4. **Friends follow-ups:** `opengame.org/add/<token>` web route (opens the app or the store); in-app QR scanner (expo-camera + prebuild).
5. **Web + browser TVs (direct mode):** the app as a website; any browser or laptop on HDMI as the TV via `tv.opengame.org` and the TV code; Chrome Cast from desktop/Android Chrome as a bonus; `profile-kit` web transport (postMessage from the host page).
6. **Google / Android TV:** Cast already works; decide direct vs stream after a device test.

## Later

- **Several households, next:** deploy (API, launcher, opengame.org `/play`, Night Flight); a household setting for the couch label (now the host's name); real pushes need devices registered with Expo; join a room mid-game (Night Flight seats only in the lobby); Trivia Jam as the second multiCouch game.

- **One API for streaming (done 2026-10-06):** `opengame-api` streams through Cloud Run `stream-gpu` (repo variable `STREAM_SERVER_URL`, applied by the API deploy workflow; TURN from the org secrets). `pnpm --filter @open-game-system/api stream:ready <api>` checks it without starting a GPU. App builds no longer need `EXPO_PUBLIC_OGS_STREAM`; the PR-5 preview and its `codeflare-containers-pr-5` app can be retired.

- **Pushes:** "a friend started a new game", with a setting. (Deferred by owner.)
- **Google and Apple sign-in** in the app (deferred by owner, 2026-10-04: email through Cloudflare for now). App code removed in 5cf8ab40; restore from there (`git show 5cf8ab40^:apps/mobile/services/sign-in-providers.ts` etc., plus `expo-apple-authentication`, `usesAppleSignIn` and a prebuild). The API's `/auth/apple` and `/auth/google` are still in place.
- **Profile switching** on one device (Netflix/YouTube style).
- **Family:** a profile group with parental controls; basis for paid family/friends plans. COPPA consent for under-13 back-up.
- **Developer setting:** test your own game (the catalogue is app config until then).
- **Amazon Fire TV app** (direct: thin WebView app; Matter Casting or TV code).
- **Samsung / LG TV web apps** (direct).
- **Apple TV app** (stream): native tvOS launcher shell + WebRTC player; Siri Remote → session moves.
- **Cloud rendering cost model:** stream only while someone is on the couch; idle shutdown; hourly cost per household before turning it on.
- **Launcher polish:** per-game focal anchors so focused cards never cover a game's subject; crisp focus crossfades; Hearthisle art kit if it joins the catalogue.

## Not planned

- **Roku:** no web engine and no WebRTC; HLS rejected (delay). Revisit if Roku adds WebRTC.
- **Phone-rendered TV via AirPlay:** rejected; the phone must not do the rendering.
- **Native per-platform game rewrites** or a native 2D "TV view" protocol.

## Decisions behind this

- [TV platforms ADR](adrs/2026-10-04-tv-platforms.md)
- [The OGS game contract](specification.md) (what a game does to run in OGS; [ADR](adrs/2026-10-04-ogs-game-contract.md))
- [Cast-kit uses app-bridge + stream-kit](adrs/2026-03-14-cast-kit-uses-app-bridge.md)
- Briefing with tonight's decisions: `exec-plans/active/2026-10-04-afternoon-briefing.md`
