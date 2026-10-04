import type { ClientMessage } from "@open-game-system/ogs-protocol";

export type RemoteButton = "up" | "down" | "left" | "right" | "ok" | "back" | "home" | "end";

/** What one press on the TV tab's remote sends to the couch session (and whether to stop casting). */
export function remotePress(
  button: RemoteButton,
  deviceId: string,
): { messages: ClientMessage[]; stopCast: boolean } {
  switch (button) {
    case "up":
    case "down":
    case "left":
    case "right":
      return { messages: [{ type: "focus.move", dir: button }], stopCast: false };
    case "ok":
      return { messages: [{ type: "select", deviceId }], stopCast: false };
    case "back":
      return { messages: [{ type: "back" }], stopCast: false };
    case "home":
      return { messages: [{ type: "home" }], stopCast: false };
    case "end":
      return { messages: [{ type: "end" }], stopCast: true };
  }
}
