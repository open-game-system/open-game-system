import type { CurrentGame } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { noViewCopy, playerCard, VIEW_TIMEOUT_MS, waitingForView } from "./starting";

const current = (over: Partial<CurrentGame> = {}): CurrentGame => ({
  appId: "bake-shop",
  instanceId: "bake-shop-1",
  mode: "new",
  roster: [],
  label: "",
  startedAt: 1000,
  viewUrl: null,
  hostDeviceId: "jonathan-phone",
  ...over,
});

describe("how long the TV waits for a started game's TV page", () => {
  it("is 20 s", () => {
    expect(VIEW_TIMEOUT_MS).toBe(20_000);
  });
});

describe("waitingForView: the sitting still waiting for its TV page (game.view)", () => {
  it("is the current sitting, keyed by when it started, while the game screen has no view", () => {
    expect(waitingForView("game", current())).toBe("bake-shop-1@1000");
  });

  it("starts a new wait when the same sitting is started again (Home, then Continue)", () => {
    expect(waitingForView("game", current({ startedAt: 5000 }))).toBe("bake-shop-1@5000");
  });

  it("is nothing once the game sent its view, off the game screen, or with no game", () => {
    expect(waitingForView("game", current({ viewUrl: "https://g.test/tv" }))).toBeNull();
    expect(waitingForView("home", current())).toBeNull();
    expect(waitingForView("game-page", current())).toBeNull();
    expect(waitingForView("game", null)).toBeNull();
  });
});

describe("playerCard: what the player says over the game", () => {
  const base = { shown: true, game: true, active: false, frameFailed: false, viewOverdue: false };

  it("Getting ready while the game hasn't sent its TV page yet", () => {
    expect(playerCard(base)).toBe("starting");
  });

  it("didn't open, once the wait for its TV page is over", () => {
    expect(playerCard({ ...base, viewOverdue: true })).toBe("no-view");
  });

  it("the frame takes over as soon as the TV page arrives, even after the wait", () => {
    expect(playerCard({ ...base, active: true, viewOverdue: true })).toBeNull();
    expect(playerCard({ ...base, active: true })).toBeNull();
  });

  it("couldn't open when the framed page never loads", () => {
    expect(playerCard({ ...base, active: true, frameFailed: true })).toBe("frame-failed");
  });

  it("nothing when the player is down or there's no game to name", () => {
    expect(playerCard({ ...base, shown: false, viewOverdue: true })).toBeNull();
    expect(playerCard({ ...base, game: false, viewOverdue: true })).toBeNull();
    expect(playerCard({ ...base, shown: false, active: true, frameFailed: true })).toBeNull();
  });
});

describe("noViewCopy: the didn't-open card, in the launcher's words", () => {
  it("names the game and sends the remote holder Home", () => {
    expect(noViewCopy("Bake Shop", "Jonathan")).toEqual({
      eyebrow: "Couldn't open",
      line: "Bake Shop didn't open on the TV",
      sub: "Press Home on Jonathan's phone to come back",
    });
  });

  it("says 'your phone' when nobody holds the remote", () => {
    expect(noViewCopy("Bake Shop", null).sub).toBe("Press Home on your phone to come back");
  });
});
