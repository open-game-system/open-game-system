import type { Manifest } from "@open-game-system/ogs-protocol";

/** Each manifest declares a HUD-free crop of its captures (art.safe); the launcher uses the same. */
export function safeCrop(
  safe: Manifest["art"]["safe"],
): { transform: { scale: number }[]; transformOrigin: string } | undefined {
  if (!safe) return undefined;
  return { transform: [{ scale: safe.scale }], transformOrigin: `${safe.ox}% ${safe.oy}%` };
}
