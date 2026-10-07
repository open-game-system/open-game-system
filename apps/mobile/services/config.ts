/** Where the app finds OGS (API, TV launcher) and which cast backend it uses. */
export type FakeCastMode = "off" | "one" | "two" | "none";

export interface AppConfig {
  apiBase: string;
  tvBase: string;
  /** off = real Google Cast; one = a simulated "Living room TV"; two = and a "Bedroom TV"; none = no TV found. */
  fakeCast: FakeCastMode;
  /** Where the fake Chromecast (a Playwright browser) takes { viewUrl }. */
  fakeCastUrl: string;
}

type Env = Record<string, string | undefined>;

const trim = (url: string) => url.replace(/\/+$/, "");

function fakeCastMode(value: string | undefined): FakeCastMode {
  if (value === "1") return "one";
  if (value === "2") return "two";
  if (value === "none") return "none";
  return "off";
}

export function readConfig(env: Env): AppConfig {
  return {
    apiBase: trim(env.EXPO_PUBLIC_OGS_API || "http://localhost:8787"),
    tvBase: trim(env.EXPO_PUBLIC_OGS_TV || "http://localhost:5180"),
    fakeCast: fakeCastMode(env.EXPO_PUBLIC_FAKE_CAST),
    fakeCastUrl: env.EXPO_PUBLIC_FAKE_CAST_URL || "http://localhost:5181/load",
  };
}

/** The OGS launcher page the cast receiver loads (LOAD_VIEW), never a game URL. */
export function launcherUrl(config: AppConfig, launcherToken: string): string {
  const api = encodeURIComponent(config.apiBase);
  return `${config.tvBase}/?api=${api}&token=${encodeURIComponent(launcherToken)}`;
}

/** True when the receiver's view is the OGS launcher (the one cast). */
export function isLauncherView(config: AppConfig, viewUrl: string | null): boolean {
  return !!viewUrl && viewUrl.startsWith(`${config.tvBase}/?`);
}

/**
 * Metro inlines EXPO_PUBLIC_* only for literal `process.env.EXPO_PUBLIC_X` reads, so they are
 * listed one by one here.
 */
export const appConfig: AppConfig = readConfig({
  EXPO_PUBLIC_OGS_API: process.env.EXPO_PUBLIC_OGS_API,
  EXPO_PUBLIC_OGS_TV: process.env.EXPO_PUBLIC_OGS_TV,
  EXPO_PUBLIC_FAKE_CAST: process.env.EXPO_PUBLIC_FAKE_CAST,
  EXPO_PUBLIC_FAKE_CAST_URL: process.env.EXPO_PUBLIC_FAKE_CAST_URL,
});
