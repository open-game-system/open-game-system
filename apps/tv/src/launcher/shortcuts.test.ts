import { describe, expect, it } from "vitest";
import { FIXTURE_GAMES } from "../session/fixture";
import { pageMove, pickSurprise } from "./shortcuts";

describe("launcher shortcuts: the Surprise pick and the game page's buttons", () => {
  it("picks a surprise at random, not the game just played", () => {
    const games = FIXTURE_GAMES.slice(0, 3); // rocket-crew, bake-shop, story-nook
    expect(pickSurprise(games, "rocket-crew", () => 0)).toBe("bake-shop");
    expect(pickSurprise(games, "rocket-crew", () => 0.99)).toBe("story-nook");
    expect(pickSurprise(games, null, () => 0)).toBe("rocket-crew");
    expect(pickSurprise(games.slice(0, 1), "rocket-crew", () => 0)).toBe("rocket-crew");
    expect(pickSurprise([], null, () => 0)).toBeNull();
  });

  it("moves between Continue and Start game on a paused game's page", () => {
    expect(pageMove("game:bake-shop", "right", true)).toBe("action:new");
    expect(pageMove("action:new", "left", true)).toBe("action:continue");
    expect(pageMove("action:new", "right", true)).toBeNull();
    expect(pageMove("game:bake-shop", "left", true)).toBeNull();
    expect(pageMove("game:bake-shop", "down", true)).toBeNull();
    expect(pageMove("game:night-flight", "right", false)).toBeNull();
  });
});
