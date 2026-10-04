import type { ClientMessage, Manifest } from "@open-game-system/ogs-protocol";

type GameStart = Extract<ClientMessage, { type: "game.start" }>;

export type LaunchPlan =
  /** Send game.start to the couch session and open the start page here as the controller. */
  | { kind: "tv"; start: GameStart; url: string }
  /** Open the game on this phone. */
  | { kind: "phone"; url: string }
  /** Not cast and the game needs a TV: show its page, whose Play asks to cast first. */
  | { kind: "needs-tv" };

/**
 * Spec v3, Where a game plays: what a tap on a game does. Cast: everything but phone-only games
 * starts in the evening's one stream. Not cast: play here, unless the game needs a TV.
 */
export function launchPlan(input: {
  manifest: Manifest;
  ogsCast: boolean;
  deviceId: string;
  mode?: "continue" | "new";
  resumeUrl?: string;
  /** Rejoin of one named sitting (a game's page lists several). Ignored for a new sitting. */
  instanceId?: string;
}): LaunchPlan {
  const { manifest, ogsCast, deviceId, mode = "continue", resumeUrl } = input;
  // Continue opens the instance's own page (its room); a new sitting starts from the start page.
  const url = mode === "new" ? manifest.startUrl : (resumeUrl ?? manifest.startUrl);
  if (ogsCast && manifest.tv !== "none")
    return { kind: "tv", start: gameStart(manifest, mode, deviceId, input.instanceId), url };
  if (manifest.tv === "required") return { kind: "needs-tv" };
  return { kind: "phone", url };
}

/** game.start for the couch session; Continue may name one sitting, a new sitting never does. */
function gameStart(
  manifest: Manifest,
  mode: "continue" | "new",
  deviceId: string,
  instanceId: string | undefined,
): GameStart {
  const named = mode === "continue" && instanceId ? { instanceId } : {};
  return { type: "game.start", appId: manifest.appId, mode, hostDeviceId: deviceId, ...named };
}
