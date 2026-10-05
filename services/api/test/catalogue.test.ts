import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE, catalogueIds, findManifest } from "../src/catalogue";

const GAMES = ["rocket-crew", "bake-shop", "story-nook", "peekaboo-garden", "night-flight"];

describe("catalogue", () => {
  it("lists the five deployed games in order", () => {
    expect(CATALOGUE.map((m) => m.appId)).toEqual(GAMES);
    expect(catalogueIds()).toEqual(GAMES);
  });

  it.each(GAMES)("%s is a room-based couch game that needs the TV", (appId) => {
    const m = findManifest(appId);
    expect(m).toBeDefined();
    expect(m?.shape).toBe("couch");
    expect(m?.tv).toBe("required");
    expect(m?.tvUrl).toBeUndefined();
    expect(m?.startUrl).toBe(`https://${appId}.jonathanrmumm.workers.dev/`);
    expect(m?.art.tile).toBe(`/art/${appId}/tv.jpg`);
    expect(m?.roles.some((r) => r.audience === "grownup")).toBe(true);
    expect(m?.roles.some((r) => r.audience === "kid")).toBe(true);
  });

  it("does not know other games", () => {
    expect(findManifest("word-duel")).toBeUndefined();
  });

  it.each(CATALOGUE.map((g) => [g.appId, g] as const))(
    "%s has the full art kit, and every file is in the TV app",
    (_id, game) => {
      const kit = [game.art.icon, game.art.cover, game.art.logo, game.art.heroClean];
      expect(kit.every((p) => typeof p === "string" && p.length > 0)).toBe(true);
      for (const p of kit)
        expect(existsSync(join(__dirname, "../../../apps/tv/public", String(p)))).toBe(true);
    },
  );

  it.each(GAMES)("%s has a music theme for the launcher's Home, in the TV app", (appId) => {
    const theme = findManifest(appId)?.art.theme;
    expect(theme).toBe(`/art/${appId}/theme.m4a`);
    expect(existsSync(join(__dirname, "../../../apps/tv/public", String(theme)))).toBe(true);
  });
});
