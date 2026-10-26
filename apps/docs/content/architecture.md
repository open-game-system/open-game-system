# Architecture

An OGS game is two web pages and, usually, a small server. Phones play the **phone page**; the TV
shows the **TV page**, framed by the OGS TV launcher. Both talk to **your room server**, and OGS
supplies who is playing. The TV picture is always drawn by **the host's phone**: the TV only shows
it. Nothing is rendered in the cloud and nothing is rendered on the TV, so a game costs OGS and you
nothing per hour played.

![Architecture: other phones run your phone page; the host phone runs your phone page and, in a second WebView, the TV launcher with your TV page; the TV only shows the picture, sent by AirPlay or WebRTC video; everything talks to your room server and the OGS API](../diagrams/architecture.svg)

The host phone runs two WebViews: your phone page, which the host plays, and the TV launcher with
your TV page, which everyone watches. Both talk to your room server like any other device. The TV
gets a picture: through AirPlay, or as WebRTC video over the home Wi-Fi.

## The pieces

| Piece | Where it runs | Who writes it | What it does |
|---|---|---|---|
| **Phone page** (`startUrl`) | A WebView in the OGS app, or in your own app built on [the shell](ship-your-own-app.md); also any phone browser | You | The controller. Reads the player's OGS profile with `useOgsProfile()` and sends moves to your room |
| **TV page** (`tvUrl`, or a room's TV URL) | An iframe inside the OGS TV launcher, 16:9, on the host phone | You | The shared screen everyone watches. Hears `ogs:start`, `ogs:suspend`, `ogs:resume`; reports its label and room |
| **TV launcher** (`apps/tv`) | A second WebView on the host phone: see [where the TV is drawn](#where-the-tv-is-drawn) | OGS | One page for the whole cast. Shows Home, frames each game, keeps one parked game loaded, never recasts |
| **Your room server** | Your Cloudflare account: a Worker, one Durable Object per room (or any server with WebSockets) | You | The game's state and rules. Verifies game tokens with `verifyOgsToken` before trusting a name |
| **OGS API** | Cloudflare Workers, run by OGS | OGS | Profiles and sign-in, the catalogue (your manifest), the couch session (a Durable Object with the TV code and who is on the couch), game tokens and their JWKS, screen pairing, push, the client log |

OGS doesn't host your game. You deploy the two pages and the room server yourself; OGS frames
them and tells them who's playing. The [game contract](contract.md) has every field and message.

### Why a Durable Object per room

A room is a small, stateful thing that every device in it talks to at once. A Durable Object gives
you exactly one instance per room id, with WebSockets that hibernate between messages and storage
that survives a restart. The reference games use `actor-kit` on top of it: one XState machine per
room, with each role's view projected from the server state. Any server that speaks WebSockets
works; OGS never talks to your room.

## Where the TV is drawn

Always on the host phone. TVs and streaming sticks aren't powerful enough to run a game's TV page
well, and a cloud GPU per household costs money every hour, so the phone in the host's hand does
it. What changes between TVs is only how the picture gets there:

![Who renders the TV: always the host phone. AirPlay: it draws on the external display iOS makes for Screen Mirroring. Chromecast and Another screen: it draws off-screen and streams WebRTC video peer to peer on the Wi-Fi, and the receiver only plays it](../diagrams/tv-paths.svg)

On every path the phone loads the **same launcher URL** with a launcher token for this couch
session, and the launcher frames your TV page the same way. Your page gets the same messages on
all of them, and runs on the same hardware: the host's phone.

### Apple TV and AirPlay TVs: the external display

iOS gives an app a second screen when the user picks **Control Center > Screen Mirroring** and an
Apple TV. The OGS app (and your own app with `cast: { airplay: true }`) puts a second, full-screen
WebView on that screen and loads the launcher in it. The phone keeps its own UI, your phone page,
so the same phone is both a controller and the renderer. Screen Mirroring carries the picture and
the sound to the TV.

- **The app has to stay in front.** iOS stops drawing a backgrounded app; the TV then shows "Open
  <app> to keep the TV going" until it comes back. The phone stays awake while it casts.
- **There is no "start mirroring" API.** Picking "Apple TV / AirPlay" in the TV picker opens short
  Screen Mirroring steps and waits for the display. Picking the AirPlay *sound* route instead gets
  "That sent sound only".
- Media in your pages never AirPlays on its own (`allowsAirPlayForMediaPlayback` is off), and the
  app never becomes the Apple TV's Now Playing app.

Decision record: [ADR 2026-10-23, AirPlay display](../../../docs/adrs/2026-10-23-airplay-display.md).

### Chromecast and Another screen: video over the local network

> **In development.** A feasibility spike is running on branch `spike/phone-p2p-cast`. What
> follows is the design; details may change. TODO(spike/phone-p2p-cast): confirm resolution, frame
> rate, latency and how audio travels once the spike reports.

The phone draws the launcher and your TV page in a WebView nobody sees on the phone, encodes it as
video, and streams it **peer to peer over the home network with WebRTC**. The other end only plays
video:

- **Chromecast:** the OGS Cast receiver (app id `807AD5E9`) receives the stream and plays it.
- **Another screen:** a smart TV's browser or a laptop. In the TV picker, **Another screen** ("Smart
  TV browser or laptop: open a link, type a code"): open the link on that screen, then type the code it shows into the
  phone, and the page there plays the stream. A paired screen stays in the picker.

As with AirPlay, the phone does the work, so the [TV performance budget](tv-performance.md) is the
phone's: rendering, encoding and battery.

### Your own app: no launcher chrome

Cast from your own app (built on the shell) and the TV shows **only your game**: the launcher runs
with `chrome=none&app=<appId>`, frames your TV page full screen with no OGS Home around it, and
still sends `ogs:start` with the couch. The same paths apply.

## The launcher protocol

The launcher and your TV page talk with `postMessage`. Every message is optional: a TV page that
answers nothing still runs.

![The launcher protocol over one sitting: the launcher loads your TV page and sends ogs:start; your page may send ogs:ready, ogs:room and ogs:resume-point; Home sends ogs:suspend and Continue sends ogs:resume](../diagrams/launcher-protocol.svg)

| Message | Direction | When | What to do |
|---|---|---|---|
| `ogs:start` | launcher → TV page | When your frame loads, and again after `ogs:ready` | Read `players` (who's on the couch) and `token` (a game token for your server). `mode` is `new` or `continue` |
| `ogs:ready` | TV page → launcher | Your page started listening after load | Nothing else: the launcher re-sends `ogs:start` |
| `ogs:suspend` | launcher → TV page | Home, or a swap to another game. Your frame is **parked**, still loaded | Go silent: suspend your `AudioContext`, pause media, stop timers that matter |
| `ogs:resume` | launcher → TV page | Continue on the parked sitting: the same frame comes back, no reload | Restart what was playing before, and only that |
| `ogs:resume-point` | TV page → launcher | The sitting's label changes ("Mission 6") | The OGS app shows it in Playing, so two sittings read apart |
| `ogs:instance` | TV page → launcher | Same purpose, as a full instance report | The launcher uses `report.title` as the label |
| `ogs:room` | TV page → launcher | Room games: the room this TV shows | The couch's other phones open your `startUrl` with `ogsRoom=<room>` and join it |

You rarely post these by hand. [profile-kit](profile-kit.md) does it:

```ts
import { onOgsPause, reportOgsSitting } from "@open-game-system/profile-kit";
import { useOgsSession } from "@open-game-system/profile-kit/react";

// Parked means silent.
onOgsPause((paused) => (paused ? audio.suspend() : audio.resume()));

// In your TV component: undefined while waiting, null outside OGS.
const session = useOgsSession();

// Whenever the label changes.
reportOgsSitting({ instanceId, appId: "comet-catch", status: "active", title: "Wave 3" });
```

### Sitting labels

A **sitting** is one play of your game on one couch (`instanceId`). Report a short label whenever
it changes, on the TV with `reportOgsSitting` (it posts `ogs:instance`) and the same call on the
phone (it goes over the app bridge). Good labels are what a person would say: "Mission 6", "Room
KQTP", "Round 3 of 5". A game that reports nothing still shows up in Playing under its name.

### Parked frames

The launcher keeps one active frame and one parked frame. A third game unloads the oldest parked
one. A parked frame keeps running JavaScript, so **its audio keeps playing unless you stop it**:
this is the bug every new OGS game ships first. The [testing page](testing.md) has a seam test for it.

## Identity in one paragraph

The launcher holds a **launcher token** that never reaches your origin. Your pages get **game
tokens**: ES256 JWTs signed by OGS for your game only (`aud` = your `appId`), on the TV for the
couch (`players`, `sid`) and on each phone for one player. Your room server calls
`verifyOgsToken(token, { appId, jwksUrl })` and trusts the name and seat only if it returns claims.
`null` means a guest in a plain browser: let them play under a name they type.
