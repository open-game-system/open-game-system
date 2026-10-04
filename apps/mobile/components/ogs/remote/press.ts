import * as Haptics from "expo-haptics";
import type { RemoteButton } from "../../../services/remote";

/** A remote key's feel: arrows tick, OK and the round keys thunk. Never throws (simulator). */
export function feel(button: RemoteButton): void {
  const style =
    button === "ok"
      ? Haptics.ImpactFeedbackStyle.Medium
      : button === "end"
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light;
  void Haptics.impactAsync(style).catch(() => {});
}

export const IDS: Record<RemoteButton, string> = {
  up: "remoteUp",
  down: "remoteDown",
  left: "remoteLeft",
  right: "remoteRight",
  ok: "remoteOk",
  back: "remoteBack",
  home: "remoteHome",
  end: "remoteEnd",
};
