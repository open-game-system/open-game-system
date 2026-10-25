import { resolve } from "node:path";
import { CONTENT_DIR, SPEC_FILE } from "./paths";

/** Sidebar groups, in order. */
export const GROUPS = [
  "Start here",
  "Build your game",
  "Your own app",
  "The ogs CLI",
  "More",
] as const;
export type Group = (typeof GROUPS)[number];

export interface PageDef {
  /** The sidebar group the page sits in; PAGES is ordered by group. */
  group: Group;
  /** URL path: `/<slug>` (HTML) and `/<slug>.md` (Markdown). `index` is `/`. */
  slug: string;
  /** Short name in the sidebar. */
  nav: string;
  /** One line for llms.txt and the page's meta description. */
  summary: string;
  /** The Markdown source (absolute path). */
  source: string;
}

const content = (name: string) => resolve(CONTENT_DIR, name);

/** Site order: the sidebar, llms.txt and llms-full.txt all follow it. */
export const PAGES: PageDef[] = [
  {
    group: "Start here",
    slug: "index",
    nav: "Overview",
    summary:
      "What OGS is (cast once, a TV launcher frames games, phones join the couch, games know who's playing) and what a game gets.",
    source: content("index.md"),
  },
  {
    group: "Start here",
    slug: "architecture",
    nav: "Architecture",
    summary:
      "The pieces (phone page, TV page, your room server, the OGS API) and where the TV picture is drawn: on the host iPhone for AirPlay, on the Chromecast itself, or in a browser on the TV; the launcher protocol as a sequence.",
    source: content("architecture.md"),
  },
  {
    group: "Start here",
    slug: "real-tv",
    nav: "Real TV in an afternoon",
    summary:
      "Your phone + TV game on a real TV in an afternoon: start from the template, run it with ogs dev, deploy to Cloudflare, then show it on a browser TV, an Apple TV (AirPlay) or a Chromecast.",
    source: content("real-tv.md"),
  },
  {
    group: "Start here",
    slug: "quickstart",
    nav: "Quickstart for agents",
    summary:
      "A numbered checklist a coding agent can follow end to end to make a web game OGS-compatible, with a copy-paste prompt.",
    source: content("quickstart.md"),
  },
  {
    group: "Build your game",
    slug: "contract",
    nav: "The game contract",
    summary:
      "The OGS game contract (single source of truth): manifest, TV page messages, phone page, token verification, rules, multi-couch rooms, planned joining.",
    source: SPEC_FILE,
  },
  {
    group: "Build your game",
    slug: "profile-kit",
    nav: "profile-kit reference",
    summary:
      "Every export of @open-game-system/profile-kit (main, /react, /server) with its signature and when to use it.",
    source: content("profile-kit.md"),
  },
  {
    group: "Build your game",
    slug: "messages",
    nav: "Messages and manifest",
    summary:
      "Launcher-to-game and game-to-launcher postMessage messages, manifest fields and shared types, generated from the ogs-protocol zod schemas.",
    source: content("messages.md"),
  },
  {
    group: "Build your game",
    slug: "tv-performance",
    nav: "TV performance budget",
    summary:
      "Design the TV page for the device that draws it: the host iPhone (AirPlay) and a Chromecast's light tier; frame, memory and asset budgets and how to measure them.",
    source: content("tv-performance.md"),
  },
  {
    group: "Build your game",
    slug: "testing",
    nav: "Testing your game",
    summary:
      "Seam tests that frame your TV page from a stand-in launcher, the phone page in a fake WebView, no-fullscreen and plain-browser checks.",
    source: content("testing.md"),
  },
  {
    group: "Build your game",
    slug: "debugging",
    nav: "Client logs and debugging",
    summary:
      "Debug the TV page and the phone page: the client log the OGS app and your own app write, Safari and Chrome inspectors for each TV path, and the usual failures.",
    source: content("debugging.md"),
  },
  {
    group: "Build your game",
    slug: "notifications",
    nav: "Notifications",
    summary:
      "Push notifications for OGS games: push handles, opting in from the OGS app or your PWA, one send call with your game's API key, pushes while open, taps and links.",
    source: content("notifications.md"),
  },
  {
    group: "Build your game",
    slug: "try-kit",
    nav: "try-kit: no-app try path",
    summary:
      "Let a stranger play from one link with no app or account: room codes that recycle, dead-end pages, a blocked-WebSocket banner, the QR, play-on-this-computer, ?ref= events and a load runner.",
    source: content("try-kit.md"),
  },
  {
    group: "Build your game",
    slug: "art-and-catalogue",
    nav: "Art kit and catalogue",
    summary:
      "The four art-kit images (sizes and rules) and how to submit a game to the OGS catalogue.",
    source: content("art-and-catalogue.md"),
  },
  {
    group: "Build your game",
    slug: "rules",
    nav: "Rules and taste",
    summary:
      "What an OGS game must and must not do: no cast button, no join codes, nothing over the TV's focal area, safe area, silent when parked, works in a plain browser.",
    source: content("rules.md"),
  },
  {
    group: "Your own app",
    slug: "ship-your-own-app",
    nav: "Ship your own app",
    summary:
      "Your game as its own App Store / Play app with casting, profiles, push links and native sign-in: create-ogs-app, configure, register with the ogs CLI, push credentials, EAS builds, App Review notes, link domains.",
    source: content("ship-your-own-app.md"),
  },
  {
    group: "Your own app",
    slug: "shell-config",
    nav: "Shell config reference",
    summary:
      "Every @open-game-system/shell option: cast (receiver, airplay), branding, link domains and scheme, push, Live Activities (behind a flag), API and TV bases, and the client log.",
    source: content("shell-config.md"),
  },
  {
    group: "Your own app",
    slug: "monetization",
    nav: "Monetization (coming)",
    summary:
      "Making money from an OGS game: being decided; what is already true and what to avoid building now.",
    source: content("monetization.md"),
  },
  {
    group: "The ogs CLI",
    slug: "cli",
    nav: "The ogs CLI",
    summary:
      "ogs, the OGS developer tool: init, dev (no device), manifest check, publish, try, push send, and your game's own app (apps register, push credentials, doctor), with the developer API they call.",
    source: content("cli.md"),
  },
  {
    group: "The ogs CLI",
    slug: "cli-init",
    nav: "ogs init",
    summary:
      "Add OGS to an existing web game in one command: the kits, ogs.manifest.json, the quickstart's code (optional codemod) and an agent prompt; GET /dev/kits.",
    source: content("cli-init.md"),
  },
  {
    group: "The ogs CLI",
    slug: "cli-dev",
    nav: "ogs dev",
    summary:
      "Run your game with a fake OGS app and TV, fake game tokens with their own JWKS, and QR codes for real phones; no device needed.",
    source: content("cli-dev.md"),
  },
  {
    group: "The ogs CLI",
    slug: "cli-catalogue",
    nav: "ogs manifest check and publish",
    summary:
      "Check ogs.manifest.json (schema, catalogue rules, live URLs; POST /manifests/check) and submit the game's catalogue entry for review (PUT /apps/:appId/catalogue-entry).",
    source: content("cli-catalogue.md"),
  },
  {
    group: "The ogs CLI",
    slug: "cli-deliver",
    nav: "ogs try and ogs push send",
    summary:
      "Deploy and register a game's try path (ogs try, PUT /apps/:appId/try) and send a test push or push link to your own handle (ogs push send, the notifications API and the handle check).",
    source: content("cli-deliver.md"),
  },
  {
    group: "More",
    slug: "faq",
    nav: "FAQ",
    summary:
      "Why not cloud streaming, which TVs work, what the phone pays for drawing the TV, and other common questions.",
    source: content("faq.md"),
  },
];

export const htmlPath = (slug: string) => (slug === "index" ? "/" : `/${slug}`);
