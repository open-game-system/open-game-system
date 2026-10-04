import type { Manifest } from "@open-game-system/ogs-protocol";

/** The "Needs a TV" badge on a Library row. */
export const needsTv = (game: Manifest): boolean => game.tv === "required";
