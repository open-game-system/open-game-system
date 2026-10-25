import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ShellConfigInput } from "@open-game-system/shell/plugin";
import type { ConfigContext, ExpoConfig } from "expo/config";
import { z } from "zod";

/**
 * Which deploy of the game this build opens: APP_ENV=preview (default; local and preview builds) or
 * production (eas.json's production profile). `pnpm run deploy[:preview]` in the game writes the
 * Worker's URL to ../deploys.json; GAME_ORIGIN overrides it (an https tunnel to `wrangler dev`).
 */
const APP_ENV = z.enum(["preview", "production"]).parse(process.env.APP_ENV ?? "preview");
const DeploysSchema = z.object({ preview: z.string().url().optional(), production: z.string().url().optional() });

function gameOrigin(): string {
  if (process.env.GAME_ORIGIN) return process.env.GAME_ORIGIN.replace(/\/$/, "");
  const file = resolve(__dirname, "..", "deploys.json");
  const deploys = existsSync(file) ? DeploysSchema.parse(JSON.parse(readFileSync(file, "utf8"))) : {};
  const origin = deploys[APP_ENV];
  if (!origin) throw new Error(`No ${APP_ENV} deploy of the game yet: run \`pnpm run deploy${APP_ENV === "preview" ? ":preview" : ""}\` in the game's folder first`);
  return origin;
}

/**
 * What the @open-game-system/shell plugin needs. It adds casting (Apple TV over AirPlay, where the
 * phone renders the TV page; Chromecast through the OGS receiver; a browser TV), profiles, push,
 * links (opengame.org/play/__OGS_APP_ID__ and __OGS_APP_ID__://join/CODE), native sign-in and the
 * splash, and passes this to <OgsShell /> at run time. The plugin checks it at prebuild.
 */
const shell = {
  appId: "__OGS_APP_ID__",
  name: "__OGS_APP_NAME__",
  /** The phone page the app opens: it makes a room and seats this phone as its host. */
  gameUrl: `${gameOrigin()}/host`,
  icon: "./assets/icon.png",
  splash: { image: "./assets/splash-icon.png", backgroundColor: "__OGS_BRAND_COLOR__" },
  branding: "hidden",
  /** workers.dev is a shared host: add your own domain here once the game has one (README "Links"). */
  linkDomains: [],
  /** airplay: an Apple TV through Screen Mirroring; the phone renders the TV page (no cloud). */
  cast: { receiver: "ogs", airplay: true },
} satisfies ShellConfigInput;

/** Android push needs your Firebase app's config (README: "Push"). Not a secret: commit it. */
const GOOGLE_SERVICES = "./google-services.json";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: shell.name,
  slug: shell.appId,
  scheme: shell.appId,
  version: "1.0.0",
  orientation: "default",
  icon: shell.icon,
  userInterfaceStyle: "automatic",
  // The plugin never sets these: they are yours.
  ios: {
    bundleIdentifier: "__OGS_BUNDLE_ID__",
    // developer.apple.com → Membership. The simulator doesn't need it; a real phone and the stores do.
    appleTeamId: "__OGS_APPLE_TEAM_ID__",
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "__OGS_ANDROID_PACKAGE__",
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "__OGS_BRAND_COLOR__" },
    ...(existsSync(GOOGLE_SERVICES) ? { googleServicesFile: GOOGLE_SERVICES } : {}),
  },
  plugins: ["expo-router", ["@open-game-system/shell", shell]],
});
