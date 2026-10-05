# Evening walkthrough: phone + TV, synced, at 7d73221d (2026-10-04)

The video was recorded at `7d73221d`, after both owner-decision commits had landed: `2df5792b` (the Rejoin pill shows only on TV, Friends and Profile) and `7d73221d` (on the game page, Start game is the one filled button and every Rejoin is outlined).

App: a Release simulator build of `design/ogs-app-hillclimb` (`EXTRA_PACKAGER_ARGS=--reset-cache`, `EXPO_PUBLIC_FAKE_CAST=2`, so it offers Living room TV and Bedroom TV) on an iPhone 17 Pro simulator (iOS 26.4). The status-bar clock is fixed at 7:42.

The TV is the fake Chromecast (`e2e/fake-chromecast.mjs`, Playwright, 1920x1080, recorded at 1280x720). It runs the launcher from HEAD (`apps/tv`, Vite).

The API is a local copy from HEAD with a fresh D1. Rocket Crew runs from `~/src/rocket-crew` HEAD (`c65baaf`) on localhost with its own state, and it trusts this API's JWKS. Bake Shop is the deployed build.

Seeded through the API (the seed script from the 2026-10-04-final run):
- Mom and Nana asked @jonathan, and Jonathan accepted both in the Friends tab. That step is cut from the video.
- Grandpa's request stays pending.
- The moment the TV loaded, two earlier sittings were reported with the TV's launcher token: Bake Shop "Day 3" and Story Nook "Page 4 of 12".
- Nana casts on "Nana's TV" from a held launcher socket.

## walkthrough.mp4

The phone is on the left and the TV on the right. The video is 1612x720, 95.9 s, played at 1.2x, 4.2 MB.

Until the cast, the TV side is a placeholder card ("Living room TV · Not casting yet"). After Stop casting, the fake Chromecast closes its page and the card says so.

The two recordings were aligned using the remote's focus moves (right, then left on the TV tab), which change both screens: TV video t=0 = phone video 72.98 s. Both moves agreed within 30 ms.

| t (s) | Phone | TV |
|---|---|---|
| 0.0 | New welcome, "Your TV is the console": its TV cycles Rocket Crew, Story Nook and Night Flight art | not casting |
| 6.4 | Make my profile: type "Jonathan", @jonathan free | |
| 12.2 | Back to the welcome | |
| 15.5 | Make my profile again: "Jonathan" and @jonathan are still filled in | |
| 18.9 | Done page "Hi, Jonathan" @jonathan, Let's go | |
| 23.9 | Library: full-bleed Rocket Crew hero, Play over the art (the friend-accept step is cut here) | |
| 29.9 | Play: "Play Rocket Crew on the TV", pick Living room TV, Cast | |
| 34.2 | Rocket Crew loading card | "Setting up the living room", then the launcher room fills with Rocket Crew |
| 35.3 | | "Getting ready · Starting Rocket Crew on Jonathan's phone" |
| 36.2 | Rocket Crew: "Jonathan, you are the Captain", with no name form | Rocket Crew framed, JONATHAN in the Captain seat |
| 45.9 | Swipe back to the Library ("Last played", Rejoin) | Launcher home: Rocket Crew "Paused just now · Started 8:30 PM", each fact once |
| 51.9 | Playing: Nana's Join card, "On Living room TV", Rocket Crew hero "Room WQRS", In progress below, no Rejoin pill | |
| 57.3 | TV tab: "OK continues Rocket Crew", the Rejoin pill above the tabs | |
| 59.3 / 62.1 | Remote right, then left | Focus moves to Story Nook, then back to Rocket Crew |
| 68.6 | Bake Shop's page: In progress "Day 3" with an outlined Rejoin, and a filled "Start game" | |
| 75.9 | Friends: Grandpa's request, Nana "Casting on Nana's TV" + Join, Mom Online, pill | |
| 81.7 | Profile, pill | |
| 89.1 | TV tab → Stop casting? sheet → Stop casting | |
| 91.1 | | The fake Chromecast closes the page |
| 93.2 | "Stopped casting on Living room TV", Cast again | |

## Stills (taken from the video)

| File | Shows |
|---|---|
| 01-welcome.jpg | The new welcome with its TV art |
| 02-profile-name-kept-after-back.jpg | The profile step after Back and forward: the name is kept |
| 03-library-hero-play.jpg | The Library hero with Play over the art |
| 04-tv-getting-ready.jpg | The phone loading Rocket Crew; the TV on "Getting ready" |
| 05-rocket-crew-joined-tv-framed.jpg | Jonathan is the Captain on the phone; the TV frames the game |
| 06-playing-no-rejoin-pill.jpg | Playing with no Rejoin pill; the TV home with Rocket Crew paused |
| 07-tv-tab-rejoin-pill.jpg | The TV tab with the Rejoin pill |
| 08-bake-shop-start-game-filled.jpg | Bake Shop's page: a filled Start game and an outlined Rejoin |

## Bugs seen

1. **The onboarding pager slides past the skipped notifications page.** Notifications were pre-granted, so the "Stay in the game" step is skipped. Even so, every tap on Make my profile on the welcome scrolls the pager across it, and "Stay in the game / Turn on notifications / Maybe later" flashes for about 0.2 s. This happened both times in this run (phone video 29.3 s and 39.6 s).
2. **The phone takes about 2.6 s to say it stopped casting.** After Stop casting is confirmed, the fake TV closes at once (the fake cast now POSTs `/stop`, which fixes bug 2 from the 2026-10-04-final run). The phone, though, keeps showing the remote, still saying "OK continues Rocket Crew", until "Stopped casting on Living room TV" appears. The cause is unverified.
3. **Rocket Crew (its repo): the TV lobby builds up on black.** For about 2 s after it's framed, the TV shows the boarding pass, the Cadet card and the Fixer and Lookout seats on a black background, without the art and without the Captain seat. Then the art arrives and JONATHAN fills the Captain seat. The phone is already on "You are the Captain" by then.
4. **Small: the phone's game loading card says "localhost" under "Rocket Crew".** It shows the start URL's host, which is expected with a local dev server. Worth checking that it shows a friendly name for deployed games.

Not bugs: swipe back from the game lands on the Library (its hero says "Last played" with Rejoin), so the walkthrough taps Playing. With the sittings seeded before Rocket Crew reported its own, the Playing hero is Rocket Crew.
