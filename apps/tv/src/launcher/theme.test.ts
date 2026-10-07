import type { Manifest } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { FIXTURE_GAMES, fixtureInstances } from "../session/fixture";
import { buildHome, type HomeModel } from "./home";
import { themeFor } from "./theme";

// Spec: docs/acceptance/2026-10-04-launcher-theme.feature
const NOW = new Date(2026, 9, 4, 19, 0).getTime();
const home = (games: Manifest[] = FIXTURE_GAMES): HomeModel =>
  buildHome({ games, instances: fixtureInstances(NOW), suspended: [], now: NOW, surpriseSeed: 0 });
const themed = (
  h: HomeModel,
  focus: string | null,
  screen: "home" | "game-page" | "game" = "home",
) => themeFor({ screen, focus, home: h, games: FIXTURE_GAMES });

describe("themeFor: which theme the launcher plays", () => {
  it("on Home, a focused game icon plays its game's theme", () => {
    const h = home();
    expect(themed(h, "game:bake-shop")).toBe("/art/bake-shop/theme.mp3");
    expect(themed(h, "game:night-flight")).toBe("/art/night-flight/theme.mp3");
  });

  it("on Home, a focused sitting card plays its game's theme", () => {
    const h = home();
    const sitting = h.cards.find((c) => c.kind === "sitting" && c.appId === "story-nook");
    expect(sitting).toBeDefined();
    expect(themed(h, sitting?.itemId ?? null)).toBe("/art/story-nook/theme.mp3");
  });

  it("Surprise me is silence: its theme would give the pick away", () => {
    const h = home();
    const surprise = h.cards.find((c) => c.kind === "surprise");
    expect(surprise).toBeDefined();
    expect(themed(h, surprise?.itemId ?? null)).toBeNull();
  });

  it("a game without a theme is silence", () => {
    expect(themed(home(), "game:hearthisle")).toBeNull();
  });

  it("no focus, or a focus that isn't on Home, is silence", () => {
    const h = home();
    expect(themed(h, null)).toBeNull();
    expect(themed(h, "game:word-duel")).toBeNull();
  });

  it.each(["game-page", "game"] as const)("the %s screen is silence", (screen) => {
    expect(themed(home(), "game:bake-shop", screen)).toBeNull();
  });

  it("a focused icon whose game isn't in the list is silence", () => {
    const h = home();
    expect(themeFor({ screen: "home", focus: "game:bake-shop", home: h, games: [] })).toBeNull();
  });
});
