import type { ClientMessage } from "@open-game-system/ogs-protocol";

export type RemoteButton = "up" | "down" | "left" | "right" | "ok" | "back" | "home" | "end";

type Press = { messages: ClientMessage[]; stopCast: boolean };

const move = (dir: "up" | "down" | "left" | "right") => (): Press => ({
  messages: [{ type: "focus.move", dir }],
  stopCast: false,
});

const PRESSES: Record<RemoteButton, (deviceId: string) => Press> = {
  up: move("up"),
  down: move("down"),
  left: move("left"),
  right: move("right"),
  ok: (deviceId) => ({ messages: [{ type: "select", deviceId }], stopCast: false }),
  back: () => ({ messages: [{ type: "back" }], stopCast: false }),
  home: () => ({ messages: [{ type: "home" }], stopCast: false }),
  end: () => ({ messages: [{ type: "end" }], stopCast: true }),
};

/** What one press on the TV tab's remote sends to the couch session (and whether to stop casting). */
export function remotePress(button: RemoteButton, deviceId: string): Press {
  return PRESSES[button](deviceId);
}
