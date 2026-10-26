/**
 * Where the phone page runs. Both the OGS app and this game's own app (@open-game-system/shell)
 * give the page the app bridge (`window.ReactNativeWebView`); only the own app adds
 * `OgsShell/<appId>` to the user agent. The OGS app casts from its own TV tab; the own app has no
 * TV tab, so there the game shows its own "Show on TV" button (the shell's native TV picker:
 * Apple TV over AirPlay, Chromecasts, a browser TV).
 */
export type PhoneHost = "browser" | "ogs-app" | "own-app";

export function phoneHost(input: { bridge: boolean; userAgent: string; appId: string }): PhoneHost {
  if (!input.bridge) return "browser";
  return input.userAgent.split(/\s+/).includes(`OgsShell/${input.appId}`) ? "own-app" : "ogs-app";
}
