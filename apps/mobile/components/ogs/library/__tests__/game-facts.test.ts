import { gameFacts } from "../game-facts";

describe("gameFacts: the game page's one line of facts from the manifest's shop block", () => {
  it("players, minutes and ages, in that order", () => {
    expect(gameFacts({ ages: "4+", minutes: [10, 20], players: "2" })).toEqual([
      "2 players",
      "10–20 min",
      "Ages 4+",
    ]);
  });
  it("a range of players and equal minutes", () => {
    expect(gameFacts({ players: "2-4", minutes: [15, 15] })).toEqual(["2–4 players", "15 min"]);
  });
  it("one player reads singular", () => {
    expect(gameFacts({ players: "1" })).toEqual(["1 player"]);
  });
  it("nothing when the manifest says nothing", () => {
    expect(gameFacts({})).toEqual([]);
  });
});
