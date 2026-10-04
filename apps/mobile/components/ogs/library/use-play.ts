import type { Manifest } from "@open-game-system/ogs-protocol";
import { openGame, useOgsCast } from "../../../services/runtime";
import type { Sitting } from "../../../services/sittings";
import { castPrompt, playAction } from "./play-action";

/**
 * Play (a new game) or Rejoin a sitting of `game`, shared by Library, the game's page and Playing.
 * Owner, 2026-10-04: the CTA is Play; when the game uses the TV and this phone isn't casting, Play
 * opens the cast prompt (CastPrompt), which casts and then plays. Cast already: it plays now.
 */
export function usePlay(game: Manifest) {
  const cast = useOgsCast();
  const play = (start: () => void) => {
    const action = playAction(game, cast);
    if (action.kind === "promptCast") castPrompt.ask({ game, phone: action.phone, play: start });
    else start();
  };
  return {
    rejoin: (s: Sitting) =>
      play(() =>
        openGame(game, { mode: "continue", resumeUrl: s.resumeUrl, instanceId: s.instanceId }),
      ),
    startNew: () => play(() => openGame(game, { mode: "new" })),
  };
}
