/**
 * A tap on the controller's Live Activity (`opengame://live-activity/<appId>`, Expo Router's
 * app/live-activity/[appId].tsx): back to the game's controller.
 * - the game's screen is open under this route: go back to it, as it was (no reload);
 * - else, a game the app knows: open it (its rejoin page: openGame continues the sitting);
 * - else: home.
 */
export type LiveActivityStep =
  | { kind: "back" }
  | { kind: "open"; appId: string }
  | { kind: "home" };

export function liveActivityStep(
  appId: string | undefined,
  now: { openApp: string | null; canGoBack: boolean; knows: (appId: string) => boolean },
): LiveActivityStep {
  if (appId && now.openApp === appId && now.canGoBack) return { kind: "back" };
  if (appId && now.knows(appId)) return { kind: "open", appId };
  return { kind: "home" };
}
