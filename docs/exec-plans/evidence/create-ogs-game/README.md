# create-ogs-game proof: Kite Count (2026-10-25)

`create-ogs-game kite-count --name "Kite Count" --team-id 34S957HD77`, then the README's steps,
scripted (`timings.txt`), on Jon's Mac: Xcode 26.4.1, an iPhone 17 Pro simulator (iOS 26.4) with
I/O > External Displays at 1920×1080 standing in for an Apple TV, the shell from this PR.

| Step | Time |
|---|---|
| create-ogs-game | 0 s |
| `pnpm install && pnpm test` | 12 s |
| `pnpm run deploy:preview` (kite-count-preview.jonathanrmumm.workers.dev) | 10 s |
| `pnpm smoke` (a round over real WebSockets against the preview) | 9 s |
| `app/ pnpm install` | 8 s |
| `pnpm e2e:ios`: prebuild 21 s, Release xcodebuild 106 s, install 1 s, external display 3 s, Maestro join → Show on TV → Apple TV / AirPlay 27 s | 158 s |
| **create → the TV page full screen on the external display** (`04-tv-lobby.jpg`) | **≈ 3 min 20 s** |
| Start → kites on the TV (`06-tv-kites.jpg`), question (`08-tv-question.jpg`) | +27 s |

Warm machine: the simulator was already booted and Xcode's module cache warm (a cold first run
adds ~40 s of boot and a few minutes of xcodebuild; the first, cold run's xcodebuild took 181 s).

Before the shell fix in this PR, the same walk ended with the shell's native idle card on the TV
(the declared TV page never reached the launcher) in a 720×480 corner of the display.

Video: `kite-count-run.mp4` (phone and TV side by side, from `pnpm e2e:record`: join, Show on TV, the TV lobby, kites, question, reveal, round two).
