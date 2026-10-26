# FAQ

## Why not cloud streaming?

OGS used to render the TV in the cloud: a GPU in a data center ran headless Chrome with the launcher
and your TV page, and streamed the picture to the Chromecast as WebRTC video. As of 25 October 2026
it doesn't. The TV is always drawn by **the host's phone**: onto an Apple TV through AirPlay, and (in
development) as video streamed peer to peer over the home Wi-Fi to a Chromecast or Another screen.
The reasons:

- **Cost.** A GPU per playing household, per hour, is a bill that grows with every family that
  likes your game. Local rendering costs nothing per hour, for you or for OGS.
- **Latency.** A cloud stream goes out to a data center and back. A phone streaming to a TV in the
  same room stays on the home network, one hop.
- **The phone is the strongest device in the room.** A recent iPhone draws a 1080p 3D TV page while
  running the controller. Chromecasts and smart TV browsers are not powerful enough to run a game's
  TV page well, so they only play video.
- **Simpler for you.** One device class to design for, the same messages on every TV.

Cloud rendering may come back later as a separate, paid product for TVs that can't draw a game. If
it does, your TV page won't need to change.

## Which TVs work?

| TV | How |
|---|---|
| Apple TV, and TVs with AirPlay | Screen Mirroring from the OGS app, or from your own app with `cast.airplay` on |
| Chromecast, and TVs with Chromecast built in | In development: the phone streams video to the OGS receiver |
| A smart TV browser or a laptop | In development: **Another screen** in the TV picker; open a link there, type its code on the phone |
| Roku | Not supported: no web engine |

## Does the host phone have to stay open?

Yes. The phone draws the TV on every path, and iOS stops drawing a backgrounded app. The TV says
"Open <app> to keep the TV going", and the app keeps the phone awake while it casts.

## Do I need to know which TV my page is on?

You don't need to: your TV page always runs on the host phone, framed the same way, with the same
messages. Pick a quality level from measured frame times ([TV performance budget](tv-performance.md)).

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
