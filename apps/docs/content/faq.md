# FAQ

## Why not cloud streaming?

OGS used to render the TV in the cloud: a GPU in a data center ran headless Chrome with the launcher
and your TV page, and streamed the picture to the Chromecast as WebRTC video. As of 25 October 2026
it doesn't. Every TV is drawn by a device in the room: the host iPhone for an Apple TV (AirPlay), the
Chromecast itself, or the TV's own browser. The reasons:

- **Cost.** A GPU per playing household, per hour, is a bill that grows with every family that
  likes your game. Local rendering costs nothing per hour, for you or for OGS.
- **Latency and glitches.** A cloud stream adds an encode, a network trip and a decode between a
  phone tap and the TV. Packet loss showed up as seconds-long freezes on the Chromecast. A page drawn
  on the device has none of that.
- **Sound and picture stay together**, and the TV page's audio doesn't go through a video pipeline.
- **The devices are good enough.** A recent iPhone draws a 1080p 3D TV page while running the
  controller, and a Chromecast can run a well-built TV page. A light tier covers the weak ones.
- **Simpler for you.** One page, the same messages on every TV, and no "stream mode" to design for.

Cloud rendering may come back later as a separate, paid product for TVs that can't draw a game. If
it does, your TV page won't need to change.

## Which TVs work?

| TV | How |
|---|---|
| Apple TV, and TVs with AirPlay | Screen Mirroring from the OGS app, or from your own app with `cast.airplay` on; the iPhone draws |
| Chromecast, and TVs with Chromecast built in | Google Cast; the Chromecast draws |
| Any TV or laptop with a modern browser | Open `ogs-tv.pages.dev` and pair with the code |
| Roku | Not supported: no web engine |

## Does the host phone have to stay open?

On AirPlay, yes: the phone draws the TV, and iOS stops drawing a backgrounded app. The TV says
"Open <app> to keep the TV going", and the app keeps the phone awake while it casts. On a Chromecast
or a browser TV, the TV keeps going on its own.

## How do I know which TV path my page is on?

You don't need to: the launcher frames your TV page the same way on each, and the messages are the
same. Pick a quality level from measured frame times ([TV performance budget](tv-performance.md)).
TODO(feat/cast-local-render): if the Chromecast light tier is signalled to the page, link it here.

## Do I need the OGS app?

No. Your game still works in a plain browser, where profile-kit returns `null`. The OGS app gives you
casting, profiles and the couch for free; [your own app](shell-config.md) does the same under your
name.

## Do I need a server?

Only if players share state, which a phone + TV game almost always does. The reference games use a
Cloudflare Worker with one Durable Object per room ([Architecture](architecture.md#why-a-durable-object-per-room)).

## Can players in two homes play together?

Yes, for games that opt in with `multiCouch`: several couches join one room of your game. See the
[contract](contract.md#7-several-couches-one-room-multicouch).

## How do I make money?

Being decided: see [Monetization](monetization.md).
