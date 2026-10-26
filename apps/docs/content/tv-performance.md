# TV performance budget

Your TV page always runs on **the host's phone**. On an Apple TV the phone draws it onto the
external display AirPlay gives it; on a Chromecast or Another screen (a smart TV browser or a
laptop) the phone draws it off-screen and streams it as video. Either way the phone is also running
your phone page, so your budget is the phone's: **render, encode and battery**.

> **Provisional numbers.** The AirPlay figures come from the AirPlay work (merged in PR #53). The
> streaming figures are design targets: phone-to-TV streaming for Chromecast and Another screen is
> in development (feasibility spike on `spike/phone-p2p-cast`). TODO(spike/phone-p2p-cast): replace
> the encode column with measured numbers (resolution, frame rate, bitrate, phone temperature).

## The budget

| | AirPlay (Apple TV) | Streamed (Chromecast, Another screen): in development |
|---|---|---|
| Who draws | The phone's GPU, in a second WebView on the external display | The phone's GPU, in an off-screen WebView |
| Who encodes | iOS, for Screen Mirroring | The phone's hardware video encoder, for WebRTC |
| Picture | The Apple TV's display mode, usually 1920×1080 | Plan for 1280×720 at 30 fps until the spike measures more |
| Frame rate to hold | 60 fps; never under 30 | 30 fps, steady |
| 3D | One WebGL renderer, PBR materials, light post-processing | The same scene, but leave headroom: the encoder shares the chip |
| Draw calls per frame | Low hundreds | Fewer: aim under about 150 |
| Texture and geometry memory | Under about 200 MB, shared with your phone page | The same |
| What hurts | Heat over a 30-minute session, then iOS throttles; your phone page competing for frames | Fine detail and full-screen noise (film grain, rain, particles) cost bitrate and turn to mush; heat from render plus encode |

**Battery.** The host phone renders, encodes and keeps its screen awake for the whole evening. A
30-minute session is the test: note the battery before and after on a real phone. Suggest hosts plug
in for long games, and keep your phone page light while the TV is up: it doesn't need its own
3D scene.

**The app must stay in front.** iOS stops drawing a backgrounded app, so the TV freezes on "Open
<app> to keep the TV going" until the host comes back.

## Rules that pay off everywhere

- **Compile every shader before play starts.** three.js compiles a material the first time it is
  drawn, so a hidden effect that first appears mid-game freezes the frame for hundreds of
  milliseconds (and on a stream, the video stalls with it). Show everything once in the lobby and
  call `renderer.compile` (against your `EffectComposer`'s render target too, if you use one). Keep
  the number of lights fixed: changing it recompiles every material. `renderer.info.programs.length`
  must not grow during play.
- **Pick a quality level from measured frame times, not from the user agent.** Render the first two
  seconds of the lobby, look at the frame times, and step down (resolution scale, effects, particle
  counts) until you hold the target. Step down again if frame times climb late in a session: that
  is the phone getting warm.
- **Design for video.** Big shapes, clear silhouettes and strong colour survive an encoder;
  hairlines, small text and full-screen noise don't. Keep text at least 28 px tall at 1080p.
- **Cap your frame rate** at what you can hold. A steady 30 is better than a ragged 60, and costs
  half the power.
- **One WebGL context per page.** Phones cap them.
- **Ship MP3 for music and voice**, about 128 kbps: every engine decodes it.
- **Preload what the next scene needs** during a quiet moment, and dispose meshes and textures you
  replace: a TV page can run for an evening.
- **Profile the moment that matters.** The busiest second of your game (the reveal, the explosion,
  the win) is the one people watch.

## How to test

| Where | How |
|---|---|
| Your desktop browser | Chrome DevTools > Performance with **CPU 4× slowdown**, and Rendering > **Frame rendering stats**. Load your TV page at 1280×720 and 1920×1080. Expose `renderer.info` behind `?debug=1` |
| [ogs dev](cli-dev.md) | The harness frames your TV page as the launcher does, with `ogs:start`, `ogs:suspend` and `ogs:resume` buttons |
| A real phone, no TV | Open your TV page in the phone's browser in landscape while your phone page runs in another tab or device: a rough stand-in for the host's load |
| AirPlay, without an Apple TV | The iOS Simulator's **I/O > External Displays** is a TV for your own app (`cast.airplay: true`). It checks layout and flow, not speed: the simulator's GPU is your Mac's |
| AirPlay, for real | Your iPhone and an Apple TV, Screen Mirroring. Play your longest session end to end: watch frames late in it, the phone's temperature and the battery drop |
| Chromecast and Another screen | In development. TODO(spike/phone-p2p-cast): how to test a streamed session and read its encode stats |

What "good" looks like: no frame over 33 ms during play on a two-year-old iPhone, no shader compile
after the lobby, memory flat over a 30-minute session, and sound that stops on Home and comes back
on Continue.
