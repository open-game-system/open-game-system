import { statusOfReport } from "@open-game-system/ogs-protocol";
import { createLiveActivity } from "@open-game-system/shell/modules/live-activity";
import {
  liveActivityAttributes,
  prepareArt,
} from "@open-game-system/shell/modules/live-activity-drivers";
import type { LiveActivityNative } from "@open-game-system/shell/modules/live-activity-native";

/**
 * Dev Tools' Live Activity preview: starts, updates and ends a sample controller activity without a
 * cast, so the lock screen and Dynamic Island layouts can be checked on a simulator or a phone. Uses
 * the same controller, native module and widget as the real one.
 */
export function createLiveActivityPreview(native: LiveActivityNative | null, now: () => number) {
  const activity = createLiveActivity({ native, now });
  return {
    available: native !== null && native.isEnabled(),
    async start(game: { appId: string; name: string; artUrl: string | null }) {
      activity.join(
        liveActivityAttributes({
          appId: game.appId,
          gameName: game.name,
          scheme: "opengame",
          roomCode: "KXTE42",
          art: await prepareArt(native, game.artUrl, game.appId),
        }),
        statusOfReport({
          instanceId: "preview",
          appId: game.appId,
          status: "lobby",
          title: "",
          detail: "",
        }),
      );
    },
    yourTurn(appId: string) {
      activity.report(
        statusOfReport({
          instanceId: "preview",
          appId,
          status: "active",
          title: "Round 3",
          detail: "",
          yourTurn: true,
        }),
      );
    },
    end: () => activity.end(),
  };
}
