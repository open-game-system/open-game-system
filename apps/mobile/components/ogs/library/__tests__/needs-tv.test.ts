import type { Manifest } from "@open-game-system/ogs-protocol";
import { needsTv } from "../needs-tv";

const game = (appId: string, tv: Manifest["tv"]): Manifest => ({
  appId,
  name: appId,
  tagline: "",
  shape: "couch",
  tv,
  startUrl: `https://${appId}.example/`,
  tvUrl: tv === "none" ? undefined : `https://${appId}.example/tv`,
  roles: [],
  art: { tile: "/t.jpg" },
  shop: {},
  instanceTtlMs: 1000,
});

describe("needsTv", () => {
  it("is true only for games that require a TV", () => {
    expect(needsTv(game("a", "required"))).toBe(true);
    expect(needsTv(game("b", "none"))).toBe(false);
    expect(needsTv(game("c", "optional"))).toBe(false);
  });
});
