import { describe, expect, it } from "vitest";
import { FIXTURE_GAMES } from "../session/fixture";
import {
  continueItem,
  pageMove,
  pickSurprise,
  readShortcut,
  SURPRISE_ITEM,
  shortcutStart,
} from "./shortcuts";

describe("launcher shortcuts (cards the protocol opens as a page)", () => {
  it("names the Surprise card and sitting cards as game items the reducer will open", () => {
    expect(SURPRISE_ITEM).toBe("game:~surprise");
    expect(continueItem("bake-shop", "bs-1")).toBe("game:~continue:bake-shop:bs-1");
  });

  it("reads an opened shortcut from the session's page", () => {
    expect(readShortcut("~surprise")).toEqual({ kind: "surprise" });
    expect(readShortcut("~continue:bake-shop:bs-1")).toEqual({
      kind: "continue",
      appId: "bake-shop",
      instanceId: "bs-1",
    });
    expect(readShortcut("~continue:bake-shop:a:b")).toEqual({
      kind: "continue",
      appId: "bake-shop",
      instanceId: "a:b",
    });
    expect(readShortcut("bake-shop")).toBeNull();
    expect(readShortcut("~continue:bake-shop")).toBeNull();
    expect(readShortcut("~other")).toBeNull();
    expect(readShortcut(null)).toBeNull();
  });

  it("continues the named sitting on the remote holder's phone", () => {
    expect(
      shortcutStart(
        { kind: "continue", appId: "bake-shop", instanceId: "bs-1" },
        { surprise: null, suspended: [], remote: "mom-phone" },
      ),
    ).toEqual({
      type: "game.start",
      appId: "bake-shop",
      mode: "continue",
      instanceId: "bs-1",
      hostDeviceId: "mom-phone",
    });
  });

  it("starts the surprise: continues it when it is paused, else starts it", () => {
    const paused = [{ appId: "night-flight", instanceId: "nf-1", label: "", at: 0 }];
    expect(
      shortcutStart(
        { kind: "surprise" },
        { surprise: "night-flight", suspended: paused, remote: null },
      ),
    ).toEqual({ type: "game.start", appId: "night-flight", mode: "continue" });
    expect(
      shortcutStart(
        { kind: "surprise" },
        { surprise: "rocket-crew", suspended: paused, remote: "p" },
      ),
    ).toEqual({ type: "game.start", appId: "rocket-crew", mode: "new", hostDeviceId: "p" });
    expect(
      shortcutStart({ kind: "surprise" }, { surprise: null, suspended: [], remote: null }),
    ).toBeNull();
  });

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
