# create-ogs-game proof: Kite Count (2026-10-25)

`create-ogs-game kite-count --name "Kite Count" --team-id 34S957HD77`, then the README's steps on
Jon's Mac (Xcode 26.4.1, iPhone 17 Pro simulator, iOS 26.4).

| Step | Time |
|---|---|
| create-ogs-game | 0.2 s |
| `pnpm install && pnpm test` (56 tests) | 8 s |
| `pnpm run deploy:preview` (kite-count-preview.jonathanrmumm.workers.dev) | 12 s |
| `GAME_ORIGIN=… pnpm smoke` (a round over real WebSockets against the preview) | 25 s |
| `app/ pnpm install` | 5 s |
| `pnpm e2e:ios`: simulator boot 41 s, expo prebuild 80 s, Release xcodebuild 181 s, install 4 s, external display 4 s, Maestro to "On Apple TV / AirPlay" 32 s, round 21 s | 363 s |
| **Create → cast connected (machine time)** | **≈ 7 min** (wall clock 9 min with two fixes made on the way: CocoaPods locale, a seam-test join race) |

Result: the phone side works end to end (join, Show on TV, the shell's picker offers
"Apple TV / AirPlay", the cast connects, a whole game plays on the phone). **The TV page does not
appear on the external display**: it keeps the shell's native idle card (`04-tv-lobby.jpg`,
`06-tv-kites.jpg`), in a 720×480 corner of the 1080p display. Causes: the single-game cast
ignores the page's declared TV view (`single-cast.ts`) and sends no `game.start` / `game.view` to
the couch session, and Kite Count is not in the catalogue (no `tvUrl`); and the TV window is not
resized when `screen.pick_mode` picks 1920×1080. See the PR.
