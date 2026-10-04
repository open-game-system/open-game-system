import type { Manifest } from "@open-game-system/ogs-protocol";

/**
 * The Library's art for one game. Today's manifests carry a 16:9 tile (and maybe a hero); the
 * proposed art kit adds cover (2:3, logo baked in), icon (1:1) and logo (transparent). Those are
 * read defensively so the Library switches to covers the day manifests carry them, with no
 * crop of 16:9 art into portrait in the meantime.
 */
export interface ArtKit {
  landscape: string;
  hero: string;
  cover: string | null;
  icon: string | null;
  logo: string | null;
}

const optional = (art: object, key: string): string | null => {
  const value: unknown = Object.entries(art).find(([k]) => k === key)?.[1];
  return typeof value === "string" && value.length > 0 ? value : null;
};

export function artKit(game: Manifest): ArtKit {
  return {
    landscape: game.art.tile,
    hero: game.art.hero || game.art.tile,
    cover: optional(game.art, "cover"),
    icon: optional(game.art, "icon"),
    logo: optional(game.art, "logo"),
  };
}

/** A shelf shows 2:3 covers only when every game on it has one, so the grid stays even. */
export const shelfShape = (games: Manifest[]): "cover" | "landscape" =>
  games.length > 0 && games.every((g) => artKit(g).cover !== null) ? "cover" : "landscape";
