export type ButtonLook = "filled" | "outlined";

export interface GamePageButtons {
  footer: {
    kind: "play" | "startGame";
    testID: "gamePlay" | "gameNew";
    label: "Play" | "Start game";
    look: ButtonLook;
  };
  /** Every sitting's Rejoin. */
  rejoin: ButtonLook;
}

type Footer = GamePageButtons["footer"];

const PLAY: Footer = { kind: "play", testID: "gamePlay", label: "Play", look: "filled" };
const START_GAME: Footer = {
  kind: "startGame",
  testID: "gameNew",
  label: "Start game",
  look: "filled",
};

/**
 * The game page's button hierarchy (owner, 2026-10-04): the footer is the one filled button,
 * Play when there's nothing to rejoin, else Start game; every sitting's Rejoin is outlined.
 */
export function gamePageButtons(sittingCount: number): GamePageButtons {
  return { footer: sittingCount > 0 ? START_GAME : PLAY, rejoin: "outlined" };
}
