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
});
