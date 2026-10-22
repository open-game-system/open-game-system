import { liveActivityStep } from "../live-activity-link";

const knows = (appId: string) => appId === "rocket-crew";

describe("a Live Activity tap (opengame://live-activity/<appId>)", () => {
  it("goes back to the game's screen when it is open underneath (the controller as it was)", () => {
    expect(
      liveActivityStep("rocket-crew", { openApp: "rocket-crew", canGoBack: true, knows }),
    ).toEqual({
      kind: "back",
    });
  });

  it("opens the game when its screen isn't open (the app was closed, or another game is open)", () => {
    for (const openApp of [null, "story-nook"])
      expect(liveActivityStep("rocket-crew", { openApp, canGoBack: true, knows })).toEqual({
        kind: "open",
        appId: "rocket-crew",
      });
    expect(
      liveActivityStep("rocket-crew", { openApp: "rocket-crew", canGoBack: false, knows }),
    ).toEqual({
      kind: "open",
      appId: "rocket-crew",
    });
  });

  it("goes home for a game the app doesn't know, or no appId", () => {
    expect(liveActivityStep("mystery", { openApp: null, canGoBack: false, knows })).toEqual({
      kind: "home",
    });
    expect(liveActivityStep(undefined, { openApp: "rocket-crew", canGoBack: true, knows })).toEqual(
      {
        kind: "home",
      },
    );
  });
});
