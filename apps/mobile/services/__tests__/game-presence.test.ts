import { createGamePresence } from "../game-presence";

describe("game presence (which game this phone has open)", () => {
  it("nothing is open at first", () => {
    expect(createGamePresence().isOpen("rocket-crew")).toBe(false);
  });

  it("a game is open from the moment it is pushed, before its screen mounts", () => {
    const p = createGamePresence();
    p.opening("rocket-crew");
    expect(p.isOpen("rocket-crew")).toBe(true);
    expect(p.isOpen("bake-shop")).toBe(false);
  });

  it("closing the game's screen forgets it", () => {
    const p = createGamePresence();
    p.opening("rocket-crew");
    p.closed("rocket-crew");
    expect(p.isOpen("rocket-crew")).toBe(false);
  });

  it("a stale close for another game keeps the open one", () => {
    const p = createGamePresence();
    p.opening("rocket-crew");
    p.opening("bake-shop");
    p.closed("rocket-crew");
    expect(p.isOpen("bake-shop")).toBe(true);
  });

  it("the host follow opens a game only when it isn't already open here", () => {
    const p = createGamePresence();
    const opened: string[] = [];
    const follow = (appId: string) => p.followHost(appId, () => opened.push(appId));
    follow("rocket-crew");
    expect(opened).toEqual(["rocket-crew"]);
    follow("rocket-crew");
    expect(opened).toEqual(["rocket-crew"]);
  });
});

describe("game presence: the TV closes the game a phone follows", () => {
  it("names the game open here", () => {
    const p = createGamePresence();
    expect(p.openApp()).toBeNull();
    p.opening("rocket-crew");
    expect(p.openApp()).toBe("rocket-crew");
  });

  it("a close request reaches the open game's screen, not another game's", () => {
    const p = createGamePresence();
    const rc = jest.fn();
    const bake = jest.fn();
    p.onClose("rocket-crew", rc);
    const off = p.onClose("bake-shop", bake);
    p.requestClose("rocket-crew");
    expect(rc).toHaveBeenCalledTimes(1);
    expect(bake).not.toHaveBeenCalled();
    off();
    p.requestClose("bake-shop");
    expect(bake).not.toHaveBeenCalled();
  });
});
