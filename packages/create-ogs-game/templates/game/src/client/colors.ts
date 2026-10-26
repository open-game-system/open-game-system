import type { Color } from "../game/rules";

/** Paint per color, chosen to stay apart for color-blind players too (plus a pattern on the TV). */
export const PAINT: Record<Color, { fill: string; label: string }> = {
  coral: { fill: "#ff6f59", label: "Coral" },
  sky: { fill: "#3fa7f5", label: "Sky" },
  lime: { fill: "#8bd346", label: "Lime" },
  gold: { fill: "#ffc93c", label: "Gold" },
};
