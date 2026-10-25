# Your phone + TV game on a real TV in an afternoon

This page takes you from nothing to your own game on the living-room TV, with phones as
controllers. It is written for people building with a coding agent as much as by hand: each step
ends with something you can see.

> **Waiting on `feat/shell-starter`.** A starter template (phone page, TV page, a room server on a
> Durable Object, and the shell app, wired together) is being built on the `feat/shell-starter`
> branch. TODO(feat/shell-starter): replace step 1 with its command and link, and drop the "add OGS
> to a game you have" route once the template covers it.

## What you need

- A computer with Node 20+ and [pnpm](https://pnpm.io).
- A free [Cloudflare](https://dash.cloudflare.com/sign-up) account, for your game's Worker.
- A phone, and one of: a TV or laptop with a web browser, an Apple TV, or a Chromecast.
- No OGS account and no Apple Developer account for the first four steps.

## 1. Start a game

**From the template** (recommended, once it lands):

```bash
# TODO(feat/shell-starter): the starter's create command goes here.
```

TODO(feat/shell-starter): link the template's README and list what it contains.

**Or add OGS to a game you have.** In your web game's repo, `ogs init` writes the manifest, vendors
the kits and writes `OGS.md`, a checklist for this repo with a prompt for your coding agent
([ogs init](cli-init.md)):

```bash
pnpm add -g @open-game-system/cli
ogs init --app-id comet-catch --name "Comet Catch" --start-url https://comet.example/ --tv-url https://comet.example/tv
```

Either way you end up with two pages: a **phone page** (the controller) and a **TV page** (the
shared screen), plus a room server if players share state.

## 2. Run it with a fake OGS (no devices yet)

Start your game's dev server, then the harness:

```bash
pnpm dev
```

```bash
ogs dev --start-url http://localhost:5173/ --tv-url http://localhost:5173/tv
```

Open `http://localhost:4747`. You see your TV page in a 16:9 frame, started with a fake couch, and
two fake phones signed in as Ada and Sam. Press **ogs:suspend**: your game must go silent. Press
**ogs:resume**: it comes back. Each fake phone has a QR code, so a real phone on your Wi-Fi can
play too. Details: [ogs dev](cli-dev.md).

## 3. Make the TV page behave on a TV

Work through the [Quickstart for agents](quickstart.md); the parts that matter on a real TV:

- Start without a tap: nobody can click the TV. Autoplay is allowed in the launcher's frame.
- Silent while parked (`onOgsPause`).
- Nothing over the middle of the screen, and everything inside the safe area (5% in from each edge).
- No cast button, room code or join QR when OGS frames you: OGS joins the couch.
- Hold 60 fps on the device that draws it: read the [TV performance budget](tv-performance.md)
  before adding the fourth particle system.

## 4. Deploy

TVs and phones need an HTTPS URL. With a Cloudflare Worker:

```bash
pnpm run deploy
```

(`pnpm run deploy`, not `pnpm deploy`: the latter is pnpm's own workspace command.) Open the
deployed TV page in a desktop browser and check it starts by itself.

## 5. Put it on the TV

Pick the TV you have.

| TV | How | What you need |
|---|---|---|
| **Any TV with a browser, or a laptop on HDMI** | Open the `ogs dev` harness (step 2) or your deployed TV page full screen on the TV; phones scan the QR codes | Nothing else. Fastest way to see your game big |
| **Any TV, through the OGS app** | Cast from the OGS app (Chromecast, Apple TV, or a browser TV at `ogs-tv.pages.dev`), then pick your game in Library | Your game in the OGS catalogue: `ogs manifest check`, then `ogs publish` ([catalogue](cli-catalogue.md)). Until it's approved, profiles and game tokens are `null` |
| **Apple TV, from your own app** | `pnpm create ogs-app app` with `cast: { receiver: "ogs", airplay: true }`, run it on your iPhone, then Control Center > Screen Mirroring | An Apple Developer account for a real iPhone ([Ship your own app](ship-your-own-app.md)) |

TODO(feat/shell-starter): if the template ships a dev path to the real launcher before catalogue
review, document it here as the first row.

## 6. Check it on the couch

On the real TV, with real phones:

- [ ] The TV shows the couch's names, and phones skip your name form.
- [ ] Home silences the TV; Continue brings it back with sound, with no reload.
- [ ] Nothing important sits under the TV's edges (TVs overscan) or over the focal area.
- [ ] It holds its frame rate through the busiest moment. On AirPlay, the phone stays cool enough to hold.
- [ ] The Playing tab shows your sitting label.

Then say which it is: tests passing, deployed, or verified on a real TV.

## Next

- [Architecture](architecture.md): what runs where, and how each TV path draws your page.
- [Client logs and debugging](debugging.md): when the TV shows nothing.
- [Ship your own app](ship-your-own-app.md): your game in the App Store.
