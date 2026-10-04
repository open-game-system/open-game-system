import type { Manifest } from "@open-game-system/ogs-protocol";

/**
 * The Library's art for one game. Every manifest has a 16:9 capture (tile, maybe hero, cropped
 * HUD-free with art.safe); the art kit adds a 2:3 cover with the title baked in, a 1:1 icon, a
 * transparent logo and a clean 16:9 hero (no text or HUD, left third free for the logo). Missing
 * kit fields fall back to the capture; the capture is never cropped into portrait.
 */
export interface ArtKit {
  landscape: string;
  hero: string;
  heroClean: string | null;
  cover: string | null;
  icon: string | null;
  logo: string | null;
}

export function artKit(game: Manifest): ArtKit {
  const { art } = game;
  return {
    landscape: art.tile,
    hero: art.hero || art.tile,
    heroClean: art.heroClean ?? null,
    cover: art.cover ?? null,
    icon: art.icon ?? null,
    logo: art.logo ?? null,
  };
}

/** A shelf shows 2:3 covers only when every game on it has one, so the grid stays even. */
export const shelfShape = (games: Manifest[]): "cover" | "landscape" =>
  games.length > 0 && games.every((g) => artKit(g).cover !== null) ? "cover" : "landscape";
