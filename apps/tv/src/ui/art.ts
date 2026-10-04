import type { Manifest } from "@open-game-system/ogs-protocol";
import type { CSSProperties } from "react";

/** Each manifest declares a HUD-free crop of its captures (art.safe): zoom past the game's own HUD. */
export function safeStyle(safe: Manifest["art"]["safe"]): CSSProperties | undefined {
  if (!safe) return undefined;
  return { transform: `scale(${safe.scale})`, transformOrigin: `${safe.ox}% ${safe.oy}%` };
}
