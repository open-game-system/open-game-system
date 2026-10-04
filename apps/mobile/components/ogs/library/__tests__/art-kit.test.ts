import type { Manifest } from "@open-game-system/ogs-protocol";
import { artKit, shelfShape } from "../art-kit";

const game = (appId: string, art: Partial<Manifest["art"]> = {}): Manifest => ({
  appId,
  name: appId,
  tagline: "",
  shape: "couch",
  tv: "required",
  startUrl: `https://${appId}.example/`,
  tvUrl: `https://${appId}.example/tv`,
  roles: [],
  art: { tile: "/t.jpg", ...art },
  shop: {},
  instanceTtlMs: 1000,
});

const kit = {
  icon: "/i.png",
  cover: "/c.jpg",
  logo: "/l.png",
  heroClean: "/hc.jpg",
};

describe("artKit: the Library's art for one game, with fallbacks to the capture", () => {
  it("a manifest with only a capture: no cover, icon, logo or clean hero", () => {
    expect(artKit(game("a"))).toEqual({
      landscape: "/t.jpg",
      hero: "/t.jpg",
      heroClean: null,
      cover: null,
      icon: null,
      logo: null,
    });
  });

  it("uses art.hero for the hero capture when present", () => {
    expect(artKit(game("a", { hero: "/h.jpg" })).hero).toBe("/h.jpg");
  });

  it("reads the art kit when the manifest carries it", () => {
    expect(artKit(game("a", kit))).toMatchObject({
      cover: "/c.jpg",
      icon: "/i.png",
      logo: "/l.png",
      heroClean: "/hc.jpg",
    });
  });
});

describe("shelfShape: covers only when every game on the shelf has one", () => {
  it("is landscape for capture-only art and for an empty shelf", () => {
    expect(shelfShape([game("a"), game("b")])).toBe("landscape");
    expect(shelfShape([])).toBe("landscape");
  });

  it("is cover when all games have covers, landscape when any lacks one", () => {
    const a = game("a", { cover: "/a.jpg" });
    expect(shelfShape([a, game("b", { cover: "/b.jpg" })])).toBe("cover");
    expect(shelfShape([a, game("b")])).toBe("landscape");
  });
});
