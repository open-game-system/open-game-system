import { loadingCaption } from "../game-loading";

describe("the caption under the game's name while it loads", () => {
  it("is the game's tagline when the catalogue knows the game, never its host", () => {
    expect(
      loadingCaption(
        { tagline: "Fly the rocket together." },
        "https://rocket-crew.jonathanrmumm.workers.dev/",
      ),
    ).toBe("Fly the rocket together.");
    expect(loadingCaption({ tagline: "A tale." }, "http://localhost:8790/")).toBe("A tale.");
  });

  it("is empty for a known game with no tagline (the name says enough)", () => {
    expect(loadingCaption({ tagline: "" }, "http://localhost:8790/")).toBe("");
  });

  it("is the host for a game the catalogue doesn't know (who you're opening)", () => {
    expect(loadingCaption(null, "https://unknown.example/play?x=1")).toBe("unknown.example");
  });

  it("is the raw text when the url doesn't parse", () => {
    expect(loadingCaption(null, "not a url")).toBe("not a url");
  });
});
