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

describe("launcher shortcuts, edges", () => {
  it("reads only a whole ~continue page", () => {
    expect(readShortcut("x~continue:rocket-crew:rc-1")).toBeNull();
    expect(readShortcut("~continue:rocket-crew:rc-1\nmore")).toBeNull();
  });

  it("continues a surprise game that is one of several paused", () => {
    const start = shortcutStart(
      { kind: "surprise" },
      {
        surprise: "bake-shop",
        suspended: [
          { appId: "rocket-crew", instanceId: "rc-1", label: "", at: 1 },
          { appId: "bake-shop", instanceId: "bs-1", label: "", at: 2 },
        ],
        remote: null,
      },
    );
    expect(start).toEqual({ type: "game.start", appId: "bake-shop", mode: "continue" });
  });

  it("a roll at the very top of the range still picks the last game", () => {
    const games = [{ appId: "a" }, { appId: "b" }, { appId: "c" }];
    expect(pickSurprise(games, null, () => 1)).toBe("c");
  });
});
