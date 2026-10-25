# TV performance budget

Your TV page is drawn by a device in the living room, not by a cloud GPU. On an Apple TV it is the
**host's iPhone**, which is also running your phone page. On a Chromecast it is **the Chromecast
itself**, and the weakest ones get a **light tier**. Design for those two and every other TV (a
smart TV's browser, a laptop) has room to spare.

> **Provisional numbers.** The phone figures come from the AirPlay work (merged in PR #53). The
> Chromecast figures are design targets until the local Cast renderer is measured on real devices.
> TODO(feat/cast-local-render): replace the light-tier table with measured numbers per model, and
> say how a TV page learns it is on the light tier.

## The two targets

| | Host iPhone (AirPlay) | Chromecast, light tier |
|---|---|---|
| Who draws | The phone's GPU, in a second WebView next to your phone page | The Chromecast's own web engine |
| Output | The Apple TV's display mode, usually 1920×1080 | Render at 1280×720 and let the TV scale it |
| Frame rate to hold | 60 fps; never under 30 | 30 fps, steady |
| 3D | Fine: one WebGL renderer, PBR materials, light post-processing | Keep it simple: unlit or Lambert materials, no shadows, no post-processing |
| Draw calls per frame | Low hundreds | Under about 50 |
| Texture and geometry memory | Under about 200 MB (the phone page shares the GPU) | Under about 64 MB |
| Audio | Web Audio is fine; Screen Mirroring carries it | Web Audio is fine; keep it to a few voices |
| What hurts | Heat over a 30-minute session, then iOS throttles; the phone page competing for frames | Fill rate (big transparent layers), shader compiles, large textures, garbage-collection pauses |

The phone has one more constraint: **it must stay in front.** iOS stops drawing a backgrounded app,
so a long game drains the host's battery. Keep the phone page light while the TV is up: it doesn't
need its own 3D scene.

## Rules that pay off everywhere

- **Compile every shader before play starts.** three.js compiles a material the first time it is
  drawn, so a hidden effect that first appears mid-game freezes the frame for hundreds of
  milliseconds. Show everything once in the lobby and call `renderer.compile` (against your
  `EffectComposer`'s render target too, if you use one). Keep the number of lights fixed: changing
  it recompiles every material. `renderer.info.programs.length` must not grow during play.
- **Pick a quality level from measured frame times, not from the user agent.** Render the first
  two seconds of the lobby, look at the frame times, and step down (resolution scale, effects,
  particle counts) until you hold the target. This works the same on every TV path.
- **Detect software WebGL** (`WEBGL_debug_renderer_info` reports SwiftShader or llvmpipe) and go
  straight to your lightest mode.
- **One WebGL context per page.** Phones and TVs cap them.
- **Ship MP3 for music and voice**, about 128 kbps: every engine decodes it.
- **Preload what the next scene needs** during a quiet moment, and dispose meshes and textures you
  replace: a TV page can run for an evening.
- **Keep the frame budget for the moment that matters.** The busiest second of your game (the
  reveal, the explosion, the win) is the one people watch; profile that one.

## Chromecast light tier

Design the light tier as a real version of your game, not a broken one:

- A 2D canvas or a simple WebGL scene at 1280×720.
- Flat or baked lighting, no real-time shadows, no bloom, depth of field or SSAO.
- Textures at most 1024×1024, compressed where you can, and a few of them.
- Fewer particles, and opaque ones where possible (transparent overdraw is the first thing to go).
- CSS animations on `transform` and `opacity` only.

TODO(feat/cast-local-render): the receiver's light-tier switch, its name, and an example of a TV
page reading it.

## How to test

| Where | How |
|---|---|
| Your desktop browser | Chrome DevTools > Performance with **CPU 6× slowdown**, and Rendering > **Frame rendering stats**. Load your TV page at 1280×720 and 1920×1080. Expose `renderer.info` behind `?debug=1` |
| [ogs dev](cli-dev.md) | The harness frames your TV page as the launcher does, with `ogs:start`, `ogs:suspend` and `ogs:resume` buttons |
| AirPlay, without an Apple TV | The iOS Simulator's **I/O > External Displays** is a TV for your own app (`cast.airplay: true`). It checks layout and flow, not speed: the simulator's GPU is your Mac's |
| AirPlay, for real | Your iPhone and an Apple TV, Screen Mirroring. Play your longest session end to end and watch for the phone heating up and frames dropping late in it |
| Chromecast | Cast from the OGS app (your game must be in the catalogue) and watch the busiest moment. TODO(feat/cast-local-render): remote-debugging steps for the local receiver |
| Any browser TV | Open `https://ogs-tv.pages.dev` on the TV, pair it, and play |

What "good" looks like: no frame over 50 ms during play on the light tier, no shader compile after
the lobby, memory flat over a 30-minute session, and sound that stops on Home and comes back on
Continue.
