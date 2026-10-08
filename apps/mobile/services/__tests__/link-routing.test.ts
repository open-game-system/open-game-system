import { openLink, routeLink } from "../link-routing";

jest.mock("../deep-links", () => ({
  extractGameUrl: (url: string) =>
    url.startsWith("https://opengame.org/open?url=")
      ? decodeURIComponent(url.split("url=")[1])
      : null,
}));

const startUrls = ["https://triviajam.tv/", "https://codebreakers.jonathanrmumm.workers.dev/"];

describe("where a link or a notification tap goes", () => {
  it("an invite or transfer link with a room starts the game in that room", () => {
    expect(routeLink("https://opengame.org/play/night-flight?room=KQTP", startUrls)).toEqual({
      kind: "play",
      appId: "night-flight",
      room: "KQTP",
    });
  });

  it("any page on a catalogue game's origin opens that page in the game's WebView", () => {
    for (const url of [
      "https://triviajam.tv/",
      "https://triviajam.tv/host/new",
      "https://codebreakers.jonathanrmumm.workers.dev/room/KQTP?x=1",
    ])
      expect(routeLink(url, startUrls)).toEqual({ kind: "game", url });
  });

  it("another origin is not a game, unless the old /open link names one", () => {
    expect(routeLink("https://elsewhere.example/", startUrls)).toBeNull();
    expect(routeLink("http://triviajam.tv/", startUrls)).toBeNull();
    expect(
      routeLink(
        `https://opengame.org/open?url=${encodeURIComponent("https://triviajam.tv/games/a")}`,
        startUrls,
      ),
    ).toEqual({
      kind: "game",
      url: "https://triviajam.tv/games/a",
    });
  });

  it("with no catalogue loaded yet, falls back to the old rules", () => {
    expect(routeLink("https://triviajam.tv/host/new", [])).toBeNull();
  });

  it("a string that isn't a URL is nothing", () => {
    expect(routeLink("not a url", startUrls)).toBeNull();
  });

  it("ignores start URLs that don't parse", () => {
    expect(routeLink("https://triviajam.tv/", ["::", "https://triviajam.tv/"])).toEqual({
      kind: "game",
      url: "https://triviajam.tv/",
    });
  });
});

describe("opening a link or a tap", () => {
  const run = (url: string, from: "link" | "push", urls = startUrls) => {
    const went: string[] = [];
    openLink(url, from, {
      startUrls: urls,
      play: (a, r) => went.push(`play:${a}:${r}`),
      game: (u) => went.push(`game:${u}`),
    });
    return went;
  };

  it("a play link starts the game in its room", () => {
    expect(run("https://opengame.org/play/night-flight?room=KQTP", "link")).toEqual([
      "play:night-flight:KQTP",
    ]);
  });

  it("a game page opens in the game", () => {
    expect(run("https://triviajam.tv/host/new", "link")).toEqual([
      "game:https://triviajam.tv/host/new",
    ]);
  });

  it("an unknown link does nothing, but a push's url still opens (catalogue not loaded yet)", () => {
    expect(run("https://elsewhere.example/", "link")).toEqual([]);
    expect(run("https://codebreakers.jonathanrmumm.workers.dev/room/A", "push", [])).toEqual([
      "game:https://codebreakers.jonathanrmumm.workers.dev/room/A",
    ]);
  });
});
