import type { Manifest } from "@open-game-system/ogs-protocol";
import { artKit, shelfShape } from "../art-kit";

const game = (appId: string, art: Record<string, unknown> = {}): Manifest => {
  const base: Manifest = {
    appId,
    name: appId,
    tagline: "",
    shape: "couch",
    tv: "required",
    startUrl: `https://${appId}.example/`,
    tvUrl: `https://${appId}.example/tv`,
    roles: [],
    art: { tile: "/t.jpg" },
    shop: {},
    instanceTtlMs: 1000,
  };
  // Extra art fields arrive from a future manifest schema; Object.assign keeps the type honest.
  Object.assign(base.art, art);
  return base;
};

describe("artKit: the Library's art, read defensively from the manifest", () => {
  it("today's manifests: only the 16:9 tile, no cover, icon or logo", () => {
    expect(artKit(game("a"))).toEqual({
      landscape: "/t.jpg",
      hero: "/t.jpg",
      cover: null,
      icon: null,
      logo: null,
    });
  });

  it("uses art.hero for the hero when present", () => {
    expect(artKit(game("a", { hero: "/h.jpg" })).hero).toBe("/h.jpg");
  });

  it("reads cover (2:3), icon (1:1) and logo when a manifest carries them", () => {
    expect(artKit(game("a", { cover: "/c.jpg", icon: "/i.png", logo: "/l.png" }))).toMatchObject({
      cover: "/c.jpg",
      icon: "/i.png",
      logo: "/l.png",
    });
  });

  it("ignores empty or non-string extras", () => {
    expect(artKit(game("a", { cover: "", icon: 3, logo: null }))).toMatchObject({
      cover: null,
      icon: null,
      logo: null,
    });
  });
});

describe("shelfShape: covers only when every game on the shelf has one", () => {
  it("is landscape for today's art and for an empty shelf", () => {
    expect(shelfShape([game("a"), game("b")])).toBe("landscape");
    expect(shelfShape([])).toBe("landscape");
  });

  it("is cover when all games have covers, landscape when any lacks one", () => {
    const a = game("a", { cover: "/a.jpg" });
    expect(shelfShape([a, game("b", { cover: "/b.jpg" })])).toBe("cover");
    expect(shelfShape([a, game("b")])).toBe("landscape");
  });
});
