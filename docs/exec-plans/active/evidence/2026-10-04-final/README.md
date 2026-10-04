# Final evidence: the cast-first OGS app at HEAD (2026-10-04)

App: Release simulator build of `design/ogs-app-hillclimb` at b9047272 on an iPhone 17 Pro simulator (iOS 26.4), `EXPO_PUBLIC_FAKE_CAST=2` (Living room TV + Bedroom TV). The TV is the fake Chromecast (Playwright, 1920x1080) running the launcher from HEAD (`apps/tv`, Vite). The API is a local copy from HEAD with a fresh D1. Rocket Crew runs from `~/src/rocket-crew` on localhost, so it uses its profile-aware code; Bake Shop is the deployed build. The status-bar clock is fixed at 7:42; the TV clock is the real time.

Seeded through the API: Mom and Nana each asked @jonathan by @id, and Jonathan accepted both in the Friends tab before the Library shot (that step isn't shown). After casting, two earlier sittings were reported with the TV's launcher token: Bake Shop "Day 3" and Story Nook "Page 4 of 12". Nana casts on "Nana's TV" from a held launcher socket. Grandpa's request stays pending.

`phone-NN-*.jpg` are 600 px wide and `tv-NN-*.jpg` are 1280 px wide. Shots with the same number were taken at the same moment.

| # | Phone | TV | What it shows |
|---|---|---|---|
| 01 | phone-01-onboarding-welcome | | First run: "Web games, supercharged", Skip, sign-in link |
| 02 | phone-02-make-profile-keyboard-next | | Make your OGS profile as "Jonathan": keyboard up, Next sits above it |
| 03 | phone-03-profile-done-back-up | | "Hi, Jonathan" @jonathan, Let's go + Back up your profile |
| 04 | phone-04-library-hero | | Library: Rocket Crew hero (Cast to play) and the All Games covers |
| 05 | phone-05-game-page-rocket-crew | | Rocket Crew's game page: art, players/minutes/ages, Cast to play |
| 06 | phone-06-tv-not-cast-which-tv | | TV tab before casting: big Cast, Which TV? (Living room / Bedroom), Join a TV |
| 07 | phone-07-remote-on-the-tv-home | tv-07 | Cast: remote with the "On the TV" card ("OK opens Rocket Crew"); the TV launcher home |
| 08 | phone-08-change-tv-picker | | Change TV picker: Living room (casting now), Bedroom, "Looking for TVs…" |
| 09 | phone-09-remote-right-1 | tv-09 | Remote right: focus moves to Bake Shop on both |
| 10 | phone-10-remote-right-2 | tv-10 | Remote right again: Story Nook on both |
| 11 | phone-11-tv-ok-rocket-crew | tv-11 | Back to Rocket Crew, OK: the TV's game page (Start game, who's here); phone says "OK starts Rocket Crew" |
| 12 | phone-12-tv-getting-ready | tv-12 | Second OK: TV "Getting ready · Starting Rocket Crew on Jonathan's phone"; the phone opens the game |
| 13 | phone-13-rocket-crew-on-phone-joined | tv-13 | Rocket Crew on the phone: "Jonathan, you are the Captain", no "Who's playing here?"; the TV frames the game with Jonathan as Captain |
| 14 | phone-14-rocket-crew-tv-framed | tv-14 | A few seconds later, still in sync |
| 15 | phone-15-after-swipe-back | tv-15 | Swipe back: the remote shows "Paused just now / OK continues Rocket Crew"; the TV is home with Rocket Crew paused |
| 16 | phone-16-playing-hero-sittings-join | tv-16 | Playing: Nana's Join card, the "On Living room TV" strip, Rocket Crew hero "Room …" with Rejoin |
| 17 | phone-17-playing-scrolled | | Playing scrolled: In progress (Story Nook Page 4 of 12, Bake Shop Day 3), Start something new |
| 18 | phone-18-bake-shop-page-before | tv-18 | Bake Shop's page with one sitting (Day 3), Start game |
| 19 | phone-19-bake-shop-start-asks | tv-19 | Start game: Bake Shop (deployed) opens on the phone; TV "Getting ready · Starting Bake Shop…" |
| 20 | phone-20-bake-shop-on-phone | tv-20 | 10 s later: the TV is still on Getting ready (see Bugs) |
| 21 | phone-21-bake-shop-tv-after-wait | tv-21 | After 20 more seconds: still Getting ready |
| 22 | phone-22-bake-shop-page-two-sittings | tv-22 | Swipe back: Bake Shop's page now lists two sittings ("Started 2:32 PM", "Day 3"); the TV is home with Bake Shop paused |
| 23 | phone-23-friends-presence-request | tv-23 | Friends: Grandpa's request (Accept / Decline), Nana "Casting on Nana's TV" + Join, Mom Online, Add a friend |
| 24 | phone-24-add-a-friend-qr-code | | Add a friend: QR, code, Share invite link, Scan their code, Find by @id |
| 25 | phone-25-profile | | Profile: Jonathan @jonathan, Not backed up / Back up, Settings |
| 26 | phone-26-remote-with-game | tv-26 | The TV tab again: "Paused just now · OK continues Bake Shop" |
| 27 | phone-27-stop-casting-confirm | tv-27 | Stop casting? (Keep casting / Stop casting) |
| 28 | phone-28-stopped-casting-cast-again | | "Stopped casting on Living room TV", Cast again, Which TV? |
| 29 | | tv-29-after-stop-casting-still-home | The fake TV after Stop casting: still the launcher home with "Jonathan has the remote" (see Bugs) |

## walkthrough.mp4

The phone (left) and the TV (right) side by side, 1612x720, 85.8 s at 1.2x speed. It runs from the TV tab before casting to Stopped casting: cast, remote focus moves, OK on Rocket Crew from the TV, Getting ready, Rocket Crew on the phone and framed on the TV, swipe back, Playing, Bake Shop, Friends, Add a friend, Profile, Stop casting.

It comes from a separate run without screenshots, because `simctl io screenshot` stalls `recordVideo` and leaves gaps in its timestamps. The two videos were aligned using the remote's focus moves, which both screens show within a frame of each other: TV video t=0 = phone video 3.6 s. That run's fake Chromecast logged `load #1 at=1791150191357`.

## Bugs seen

1. **Deployed Bake Shop never reaches the TV.** If you start it from its page while casting, the phone opens the game but the launcher stays on "Getting ready · Starting Bake Shop on Jonathan's phone" (the fake Chromecast's `/launcher` returns `screen: game, starting: true, frameApp: null`) for over 30 s, until you swipe back. Rocket Crew from localhost frames fine, so this is probably the deployed build lacking the OGS hand-off (not yet deployed; unverified). The launcher has no timeout or way out of Getting ready.
2. **The fake cast never stops the fake TV.** After Stop casting → confirm, the fake Chromecast still shows the home with "Jonathan has the remote" (tv-29). In `apps/mobile/services/fake-cast.ts`, `endCurrentSession` only fires `ended` and never POSTs `/stop` to the fake Chromecast. A real receiver would close, so this is a test-harness gap. The launcher also keeps showing the remote holder after the couch's `end`, which is unverified on a real device.
3. **Rocket Crew (its repo): the name overlaps the badge.** On the TV, "JONATHAN" in the Captain slot runs under the round "1" badge (tv-13).
4. **Rocket Crew: the phone copy is stale inside OGS.** The Captain screen says "Put the game on the TV, then have your Fixer scan the code" while the game is already on the TV (phone-13).
5. **Small: the profile @id field is half covered.** With the keyboard up on Make your OGS profile, the @id field and its "free" check are half hidden behind the Next footer (phone-02).
