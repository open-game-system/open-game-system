import {
  type InstanceReport,
  type LiveActivityRegistration,
  type Manifest,
  type SessionState,
  statusOfReport,
} from "@open-game-system/ogs-protocol";
import { createLiveActivity } from "@open-game-system/shell/modules/live-activity";
import {
  artUrlOf,
  followCouch,
  liveActivityAttributes,
  prepareArt,
  registerPushTokens,
} from "@open-game-system/shell/modules/live-activity-drivers";
import type { LiveActivityNative } from "@open-game-system/shell/modules/live-activity-native";
import { z } from "zod";

/**
 * The OGS app's controller Live Activity (docs/acceptance/2026-10-21-live-activities.feature): while
 * this phone is on a couch whose TV plays a game, the lock screen and Dynamic Island show it. The
 * couch session starts, relabels and ends it; the open game's own INSTANCE_REPORTs update it; its
 * push token is registered under the couch session for remote updates. Off unless the build has the
 * extension (OGS_LIVE_ACTIVITIES=1 → extra.ogsLiveActivities), and a no-op when the user disallowed
 * Live Activities.
 */

/** The flag the shell's withShellLiveActivity writes into the app config. */
export function liveActivitiesBuilt(expoConfig: unknown): boolean {
  const parsed = z
    .object({ extra: z.object({ ogsLiveActivities: z.literal(true) }) })
    .safeParse(expoConfig);
  return parsed.success;
}

export interface AppLiveActivityDeps {
  native: LiveActivityNative | null;
  couch: { getState(): SessionState | null; subscribe(listener: () => void): () => void };
  /** A game in the library or catalogue. */
  findGame: (appId: string) => Pick<Manifest, "name" | "art"> | undefined;
  /** This phone's couch session: its id (tokens) and TV code (shown on the lock screen). */
  session: () => { sessionId: string; code: string } | null;
  tvBase: string;
  /** The app's URL scheme (app.json `scheme`). */
  scheme: string;
  environment: () => Promise<LiveActivityRegistration["environment"]>;
  post: (sessionId: string, registration: LiveActivityRegistration) => Promise<unknown>;
  now: () => number;
}

export function createAppLiveActivity(deps: AppLiveActivityDeps) {
  const activity = createLiveActivity({
    native: deps.native,
    now: deps.now,
    onPushToken: registerPushTokens({
      sessionId: () => deps.session()?.sessionId ?? null,
      app: "ogs",
      environment: deps.environment,
      post: deps.post,
    }),
  });

  const stopFollowing = followCouch(activity, deps.couch, async (appId) => {
    const game = deps.findGame(appId);
    if (!game) return null;
    const art = artUrlOf(game.art.icon ?? game.art.tile, deps.tvBase);
    return liveActivityAttributes({
      appId,
      gameName: game.name,
      scheme: deps.scheme,
      roomCode: deps.session()?.code ?? null,
      art: await prepareArt(deps.native, art, appId),
    });
  });

  return {
    /** The open game's own report (its `ogs` store): only for the game the activity shows. */
    report(report: InstanceReport): void {
      if (activity.current()?.appId === report.appId) activity.report(statusOfReport(report));
    },
    stop(): void {
      stopFollowing();
      activity.dispose();
    },
  };
}

export type AppLiveActivity = ReturnType<typeof createAppLiveActivity>;
