import { LauncherToGameSchema } from "@open-game-system/ogs-protocol";
import type { FrameWindow } from "./session";

/**
 * Calls `onPause(true)` when the OGS launcher parks this game's TV page (Home, or a swap to another
 * game) and `onPause(false)` when Continue brings it back. A parked page stays loaded so Continue
 * needs no reload, so it must silence itself: suspend its AudioContext, pause its media.
 * Returns a function that stops listening. A page that isn't framed never pauses.
 */
export function listenForPause(onPause: (paused: boolean) => void, win: FrameWindow): () => void {
  const parent = win.parent;
  if (!parent || parent === win) return () => {};
  const handler = (ev: { data: unknown; source: unknown }) => {
    if (ev.source !== parent) return;
    const parsed = LauncherToGameSchema.safeParse(ev.data);
    if (!parsed.success) return;
    if (parsed.data.type === "ogs:suspend") onPause(true);
    else if (parsed.data.type === "ogs:resume") onPause(false);
  };
  win.addEventListener("message", handler);
  return () => win.removeEventListener("message", handler);
}
