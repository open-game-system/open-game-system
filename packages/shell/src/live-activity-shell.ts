import type { Store } from "@open-game-system/app-bridge-types";
import type { LiveActivityRegistration } from "@open-game-system/ogs-protocol";
import { z } from "zod";
import type { NativeCastEvents, NativeCastState } from "./cast-store";
import { DEFAULT_TV_BASE } from "./cast-stores";
import { createLiveActivity } from "./live-activity";
import {
  artUrlOf,
  followCastSession,
  liveActivityAttributes,
  prepareArt,
  registerPushTokens,
  reportToActivity,
  teeStore,
} from "./live-activity-drivers";
import type { LiveActivityNative } from "./live-activity-native";
import type { OgsBridgeState, UntrustedEvent } from "./ogs-bridge";
import type { ShellContext } from "./shell-runtime";

const RegisteredSchema = z.object({ activityId: z.string() });
const CatalogueArtSchema = z.array(
  z.object({
    appId: z.string(),
    art: z.object({ tile: z.string(), icon: z.string().optional() }),
  }),
);

export interface ShellLiveActivityOptions {
  /** loadLiveActivityNative() on a device; null without the module. */
  native: LiveActivityNative | null;
  /** The build's APNs environment (the activity's push token is for that one). */
  environment: () => Promise<LiveActivityRegistration["environment"]>;
  now?: () => number;
}

type GameStores = {
  cast: Store<NativeCastState, NativeCastEvents>;
  ogs: Store<OgsBridgeState, UntrustedEvent>;
};

/**
 * A single-game app's Live Activity (shell config `liveActivities`): started when the phone's cast
 * connects (it is the controller for the game on the TV), updated by the game's INSTANCE_REPORTs,
 * ended with the cast. Its push token is registered under the couch session the cast made, so OGS
 * can update it from the TV's side while the phone is locked. The art is the catalogue's icon.
 */
export function shellLiveActivity(ctx: ShellContext, opts: ShellLiveActivityOptions) {
  const { appId, name } = ctx.config;
  let session: { sessionId: string; code: string | null } | null = null;
  const activity = createLiveActivity({
    native: opts.native,
    now: opts.now ?? Date.now,
    onPushToken: registerPushTokens({
      sessionId: () => session?.sessionId ?? null,
      app: appId,
      environment: opts.environment,
      post: async (sid, registration) => {
        const identity = ctx.getIdentity();
        if (!identity) return null;
        return ctx.request(RegisteredSchema, `/api/v1/sessions/${sid}/live-activities`, {
          method: "POST",
          body: registration,
          token: identity.deviceToken,
        });
      },
    }),
  });
  ctx.onStop(() => activity.dispose());

  let art: Promise<string | null> | null = null;
  const loadArt = async (): Promise<string | null> => {
    try {
      const games = await ctx.request(CatalogueArtSchema, "/api/v1/catalogue");
      const game = games.find((g) => g.appId === appId);
      if (!game) return null;
      const url = artUrlOf(game.art.icon ?? game.art.tile, ctx.config.tvBase ?? DEFAULT_TV_BASE);
      return await prepareArt(opts.native, url, appId);
    } catch {
      return null;
    }
  };

  const attributes = async () => {
    art ??= loadArt();
    return liveActivityAttributes({
      appId,
      gameName: name,
      scheme: ctx.config.schemes?.[0] ?? appId,
      roomCode: session?.code ?? null,
      art: await art,
    });
  };

  return {
    activity,
    /** castGameStores' onSession: the couch session each cast makes. */
    onSession(next: { sessionId: string; code: string | null }) {
      session = next;
    },
    /** Follows the cast and the game's reports; the `ogs` store comes back teed. */
    attach<T extends GameStores>(stores: T): T {
      ctx.onStop(followCastSession(activity, stores.cast, attributes));
      return { ...stores, ogs: teeStore(stores.ogs, reportToActivity(activity, appId)) };
    },
  };
}
