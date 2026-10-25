# Architecture

An OGS game is two web pages and, usually, a small server. Phones play the **phone page**; the TV
shows the **TV page**, framed by the OGS TV launcher. Both talk to **your room server**, and OGS
supplies who is playing. Every picture is drawn on a device the family already owns: the host's
iPhone, the Chromecast, or the TV's own browser. Nothing is rendered in the cloud, so a game costs
OGS and you nothing per hour played.

![Architecture: phones run your phone page, the TV launcher frames your TV page, both talk to your room server, and to the OGS API for profiles, the catalogue, the couch session and game tokens](../diagrams/architecture.svg)

Phones and the TV launcher both talk to your room server (game state) and to the OGS API (who is
playing). Your room server checks OGS game tokens against the API's public key set.

## The pieces

| Piece | Where it runs | Who writes it | What it does |
|---|---|---|---|
| **Phone page** (`startUrl`) | A WebView in the OGS app, or in your own app built on [the shell](ship-your-own-app.md); also any phone browser | You | The controller. Reads the player's OGS profile with `useOgsProfile()` and sends moves to your room |
| **TV page** (`tvUrl`, or a room's TV URL) | An iframe inside the OGS TV launcher, 16:9 | You | The shared screen everyone watches. Hears `ogs:start`, `ogs:suspend`, `ogs:resume`; reports its label and room |
| **TV launcher** (`apps/tv`) | On the TV device: see [where the TV is drawn](#where-the-tv-is-drawn) | OGS | One page for the whole cast. Shows Home, frames each game, keeps one parked game loaded, never recasts |
| **Your room server** | Your Cloudflare account: a Worker, one Durable Object per room (or any server with WebSockets) | You | The game's state and rules. Verifies game tokens with `verifyOgsToken` before trusting a name |
| **OGS API** | Cloudflare Workers, run by OGS | OGS | Profiles and sign-in, the catalogue (your manifest), the couch session (a Durable Object with the TV code and who is on the couch), game tokens and their JWKS, push, the client log |

OGS doesn't host your game. You deploy the two pages and the room server yourself; OGS frames
them and tells them who's playing. The [game contract](contract.md) has every field and message.

### Why a Durable Object per room

A room is a small, stateful thing that every device in it talks to at once. A Durable Object gives
you exactly one instance per room id, with WebSockets that hibernate between messages and storage
that survives a restart. The reference games use `actor-kit`
on top of it: one XState machine per room, with each role's view projected from the server state.
Any server that speaks WebSockets works; OGS never talks to your room.

## Where the TV is drawn

The TV launcher is a web page, so anything with a capable web engine can draw it. OGS uses three,
and the host phone picks one in its TV picker:

![Who renders the TV: for AirPlay the host iPhone draws the TV page and Screen Mirroring sends the picture; for a Chromecast the phone sends a URL and the Chromecast draws it; a browser TV pairs by a code and draws it itself](../diagrams/tv-paths.svg)

On every path the TV loads the **same launcher URL** with a launcher token for this couch session,
and the launcher frames your TV page the same way. Your page gets the same messages on all three.

### Apple TV and AirPlay TVs: the host iPhone draws it

iOS gives an app a second screen when the user picks **Control Center > Screen Mirroring** and an
Apple TV. The OGS app (and your own app with `cast: { airplay: true }`) puts a second, full-screen
WebView on that screen and loads the launcher in it. The phone keeps its own UI, your phone page,
so the same phone is both the controller and the renderer. Screen Mirroring carries the picture and
the sound to the TV.

What that means for you:

- **Your TV page runs on the phone's GPU**, next to your phone page. Budget for it: see
  [TV performance budget](tv-performance.md).
- **The app has to stay in front.** iOS stops drawing a backgrounded app; the TV then shows "Open
  <app> to keep the TV going" until it comes back. The phone stays awake while it casts.
- **There is no "start mirroring" API.** Picking "Apple TV / AirPlay" in the TV picker opens short
  Screen Mirroring steps and waits for the display. Picking the AirPlay *sound* route instead gets
  "That sent sound only".
- Media in your pages never AirPlays on its own (`allowsAirPlayForMediaPlayback` is off), and the
  app never becomes the Apple TV's Now Playing app.

Decision record: [ADR 2026-10-23, AirPlay display](../../../docs/adrs/2026-10-23-airplay-display.md).

### Chromecast: the Chromecast draws it

The host phone sends the launcher URL to the OGS Cast receiver (a custom receiver app, id
`807AD5E9`), and the Chromecast loads and draws the launcher and your TV page itself. Chromecasts
range from capable to weak, so the receiver has a **light tier** for the weak models.

> **Waiting on `feat/cast-local-render`.** The Chromecast's local renderer is being built now.
> TODO(feat/cast-local-render): which models get the light tier, how it is chosen, and whether your
> TV page is told (a URL parameter or a field on `ogs:start`). Until it lands, design for the
> [light-tier budget](tv-performance.md#chromecast-light-tier) and don't rely on a signal.

### Browser TVs: the TV's browser draws it

Any TV or laptop with a modern browser can open `https://ogs-tv.pages.dev`, which shows a code. The
host types the code in the TV picker ("Use a browser TV"), and the OGS API hands that screen the
launcher for the couch. A paired browser TV stays in the picker. It's also the easiest way to put
your game on a real TV while you develop: see [Real TV in an afternoon](real-tv.md).

### Your own app: no launcher chrome

Cast from your own app (built on the shell) and the TV shows **only your game**: the launcher runs
with `chrome=none&app=<appId>`, frames your TV page full screen with no OGS Home around it, and
still sends `ogs:start` with the couch. The same three paths apply.

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
