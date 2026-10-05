import { gamePageButtons } from "../game-page-buttons";

// Owner, 2026-10-04: the footer is the game page's one filled button. With sittings it is
// "Start game", and every sitting's Rejoin is outlined (supersedes "the newest Rejoin is filled").
describe("gamePageButtons", () => {
  it("with nothing to rejoin, the footer is Play, filled", () => {
    expect(gamePageButtons(0)).toEqual({
      footer: { kind: "play", testID: "gamePlay", label: "Play", look: "filled" },
      rejoin: "outlined",
    });
  });

  it.each([1, 2, 5])("with %i sittings, the footer is Start game, filled", (count) => {
    expect(gamePageButtons(count).footer).toEqual({
      kind: "startGame",
      testID: "gameNew",
      label: "Start game",
      look: "filled",
    });
  });

  it.each([1, 2, 5])("with %i sittings, every Rejoin is outlined", (count) => {
    expect(gamePageButtons(count).rejoin).toBe("outlined");
  });
});
