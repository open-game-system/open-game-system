# Shell config reference

`@open-game-system/shell` turns your game into its own iOS and Android app: your phone page full
screen in a WebView, with casting, OGS profiles and native sign-in, push links and haptics. It is an
Expo config plugin plus one component, `<OgsShell />`. [Ship your own app](ship-your-own-app.md)
walks through creating, building and submitting one; this page is every option.

The options go in `app.config.ts` and are checked at prebuild. A bad field fails the build with
`@open-game-system/shell: invalid config. <field>: <problem>`.

```ts
import type { ShellConfigInput } from "@open-game-system/shell/plugin";

const shell = {
  appId: "comet-catch",
  name: "Comet Catch",
  gameUrl: "https://comet.example/phone",
  icon: "./assets/icon.png",
  splash: { image: "./assets/splash-icon.png", backgroundColor: "#14213d" },
  branding: "hidden",
  linkDomains: ["comet.example"],
  cast: { receiver: "ogs", airplay: true },
} satisfies ShellConfigInput;

// plugins: ["expo-router", ["@open-game-system/shell", shell]]
```

## All options

| Option | Default | What it does |
|---|---|---|
| `appId` | required | Your OGS catalogue id (`a-z`, `0-9`, `-`). Names your `opengame.org/play/<appId>` links, the default URL scheme and the `OgsShell/<appId>` user agent |
| `gameUrl` | required | The phone page the app opens (`https://` only). Deploy the web game and every installed app has it |
| `name` | required | The app's name, also used in the local-network prompt and on the loading and offline screens |
| `icon` | none | Your app icon |
| `splash` | none | `{ image, backgroundColor? }` for the splash screen |
| `branding` | `"hidden"` | `"powered-by"` shows a small "Powered by OGS" on the loading and offline screens, never over your game |
| `linkDomains` | `[]` | Your own domains (`comet.example`, no scheme). Links on them open the app |
| `scheme` | the `appId` | Your custom URL scheme, set only when the app has none |
| `cast` | `{ receiver: "ogs" }` | Which TVs the app can show your game on. See [Casting](#casting) |
| `liveActivities` | off | iOS Live Activities, **behind a flag** and not on `main` yet. See [Live Activities](#live-activities) |
| `apiBase` | the production OGS API | Point a test build at a preview API |
| `tvBase` | `https://ogs-tv.pages.dev` | The TV launcher that TVs load. For test builds |

The plugin never sets your bundle id, Android package or Apple Team ID: those stay in your own
Expo config.

## Casting

```ts
cast: { receiver: "ogs", airplay: true }
```

- **`receiver`**: `"ogs"`, the only one: the OGS Cast app on Chromecasts, which draws your TV
  page on the Chromecast itself ([how](architecture.md#chromecast-the-chromecast-draws-it)).
  Browser TVs (pair by the code at `ogs-tv.pages.dev`) are always offered too.
- **`airplay`**: `true` also offers **Apple TV / AirPlay** on iOS. The user picks Screen Mirroring, and
  your app draws your TV page on the external display iOS gives it, while the phone keeps your
  controller ([how](architecture.md#apple-tv-and-airplay-tvs-the-host-iphone-draws-it)). It adds a small
  native module; the next release after turning it on is a store build, not an over-the-air update.

Whichever TV is picked, it shows **only your game** (`chrome=none`): no OGS Home around it, and your
TV page still gets `ogs:start` with the couch. Draw the cast button yourself with
`@open-game-system/cast-kit-react`, and show it only in your own app
(`navigator.userAgent.includes("OgsShell/comet-catch")`): inside the OGS app, OGS casts once for
every game.

TODO(feat/cast-local-render): if the Chromecast light tier gets a shell option, add it here.

## Branding

`"hidden"` (the default) makes OGS invisible: your name, icon and splash everywhere. `"powered-by"`
adds a small mark on the loading and offline screens only. Players who sign in get one OGS account
that works in every OGS-powered app either way.

## Links

Three kinds of link open your app at a page of your game, keeping the query and hash:

| Link | Needs |
|---|---|
| `https://opengame.org/play/<appId>/<path>` | Registering the app with `ogs apps register` (OGS serves the link files) |
| `https://<a link domain>/<path>` | `linkDomains`, and the two link files from `link-files/.well-known/` on that domain |
| `<scheme>://<path>` (also `<scheme>://play/<path>`) | Nothing: works in the simulator and before link files are live |

A launch link is the WebView's first page. `ogs doctor --domain <domain>` checks the link files.

## Push

There's no push option: the plugin always adds push. When your page asks for notifications, the app
asks the OS, takes the native device token and registers it with OGS. Your server sends with your
game's API key exactly as on [Notifications](notifications.md), and OGS delivers with **your** APNs
key and FCM service account, uploaded once with `ogs push credentials`. A push with a `url` opens
the app at that page.

## Live Activities

> **Behind a flag, not merged.** Live Activities are in PR #52 (`feat/live-activities`), which ships
> dark. Options and behaviour below are from that branch and may change before it merges.

```ts
liveActivities: true
```

While the phone is the controller for your game on the TV, the iOS lock screen and Dynamic Island
show your game: key art (or a monogram), its name, a status line built from your sitting label
("Round 3 · Your turn") and the TV code. A tap brings the app back to the controller. It starts when
the phone joins, updates at most every 5 seconds, and ends with the session, after 30 minutes idle,
or 4 hours in. It adds a widget extension and an app group (`group.<bundleId>.ogs`), so it needs a
store build. The API side is off unless OGS turns it on.

You feed it nothing new: report your sitting label with `reportOgsSitting`, as you already do.

## Client log

There's no option for it. With `cast.airplay` on, your app sends its cast and AirPlay steps
(`airplay.*`, `native.*`) to OGS's client log under your `appId`, one id per app launch, with tokens
and secrets removed. That is how a failed cast on a family's TV gets diagnosed:
[Client logs and debugging](debugging.md) lists the events and how to get them read.

## Testing a build

| To test | Set |
|---|---|
| A preview OGS API | `apiBase: "https://<preview>.workers.dev"` |
| A preview TV launcher | `tvBase: "https://<branch>.ogs-tv.pages.dev"` |
| AirPlay without an Apple TV | `airplay: true`, then the iOS Simulator's **I/O > External Displays** |

The shell's native screens have test ids for Maestro or Detox; the list is on
[Ship your own app](ship-your-own-app.md#testing-on-a-device).
