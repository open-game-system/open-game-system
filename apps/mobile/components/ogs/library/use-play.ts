import type { Manifest } from "@open-game-system/ogs-protocol";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  castBackend,
  castNow,
  openGame,
  useOgsCast,
  waitForOgsCast,
} from "../../../services/runtime";
import type { Sitting } from "../../../services/sittings";
import { userMessage } from "../../../services/user-message";

/**
 * Rejoin a sitting or start a new game of `game`, shared by the Library hero and the game's page.
 * Spec v3, tv: required and not cast: casts to the first TV first (no TV found: the TV tab).
 */
export function usePlay(game: Manifest) {
  const router = useRouter();
  const cast = useOgsCast();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const needsCast = game.tv === "required" && !cast;

  /** Casts to the first TV, then runs `play` once the TV is the OGS launcher. */
  const castThen = async (play: () => void) => {
    const tv = castBackend.getDevices()[0];
    if (!tv) {
      router.navigate("/tv");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const result = await castNow(tv);
      if (result === "started" && (await waitForOgsCast(8000))) play();
      else setNote("The TV didn't answer. Try again from the TV tab.");
    } catch (err) {
      setNote(userMessage(err, "cast").text);
    } finally {
      setBusy(false);
    }
  };
  const play = (start: () => void) => (needsCast ? void castThen(start) : start());
  return {
    busy,
    note,
    needsCast,
    rejoin: (s: Sitting) =>
      play(() =>
        openGame(game, { mode: "continue", resumeUrl: s.resumeUrl, instanceId: s.instanceId }),
      ),
    startNew: () => play(() => openGame(game, { mode: "new" })),
  };
}
