import type { CSSProperties } from "react";
import type { GameManifest } from "../../world";

export type Vars = CSSProperties & { [k: `--${string}`]: string };

/** A game's own palette as CSS variables, so the host chrome around it takes the game's colours. */
export const gameVars = (g: GameManifest): Vars => ({
  "--g-ground": g.palette.ground,
  "--g-ink": g.palette.ink,
  "--g-accent": g.palette.accent,
  "--g-accent2": g.palette.accent2,
});
