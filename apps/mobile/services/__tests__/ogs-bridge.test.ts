import { createOgsBridgeStore } from "../ogs-bridge";

const report = {
  instanceId: "rc-1",
  appId: "rocket-crew",
  status: "suspended",
  title: "Mission 6",
  detail: "",
};

describe("the ogs bridge store (a game reports its instance from the app's WebView)", () => {
  it("posts a valid INSTANCE_REPORT with source bridge and remembers the game reported", async () => {
    const post = jest.fn(async () => undefined);
    const store = createOgsBridgeStore(post);
    store.dispatch({ type: "INSTANCE_REPORT", report: { ...report, status: "suspended" } });
    expect(post).toHaveBeenCalledWith(report, "bridge");
    expect(store.getSnapshot().reported).toEqual(["rocket-crew"]);
  });

  it("drops anything that doesn't match the protocol (the page is untrusted)", () => {
    const post = jest.fn(async () => undefined);
    const store = createOgsBridgeStore(post);
    // The bridge hands over whatever JSON the page sent; the store must parse it.
    store.dispatch({ type: "INSTANCE_REPORT", report: { appId: "x", status: "nope" } });
    store.dispatch({ type: "SOMETHING_ELSE" });
    expect(post).not.toHaveBeenCalled();
    expect(store.getSnapshot().reported).toEqual([]);
  });

  it("a failed post is logged, not thrown into the bridge", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const store = createOgsBridgeStore(async () => {
      throw new Error("offline");
    });
    store.dispatch({ type: "INSTANCE_REPORT", report: { ...report, status: "suspended" } });
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("remembers each game once, and tells subscribers until they leave", () => {
    const store = createOgsBridgeStore(async () => undefined);
    const seen = jest.fn();
    const off = store.subscribe(seen);
    store.dispatch({ type: "INSTANCE_REPORT", report });
    store.dispatch({ type: "INSTANCE_REPORT", report: { ...report, title: "Mission 7" } });
    expect(store.getSnapshot().reported).toEqual(["rocket-crew"]);
    expect(seen).toHaveBeenCalled();
    const calls = seen.mock.calls.length;
    off();
    store.dispatch({ type: "INSTANCE_REPORT", report: { ...report, appId: "bake-shop" } });
    expect(seen).toHaveBeenCalledTimes(calls);
    expect(store.getSnapshot().reported).toEqual(["rocket-crew", "bake-shop"]);
  });

  it("has no event listeners to offer the page (on is a no-op that unsubscribes)", () => {
    const store = createOgsBridgeStore(async () => undefined);
    const off = store.on("INSTANCE_REPORT", jest.fn());
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
  });

  it("logs a failed post by name", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const err = new Error("offline");
    const store = createOgsBridgeStore(async () => {
      throw err;
    });
    store.dispatch({ type: "INSTANCE_REPORT", report });
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledWith("[ogs] could not post the game's instance report:", err);
    warn.mockRestore();
  });

  it("reset forgets what was reported (a new game screen)", () => {
    const store = createOgsBridgeStore(async () => undefined);
    store.dispatch({ type: "INSTANCE_REPORT", report: { ...report, status: "suspended" } });
    store.reset();
    expect(store.getSnapshot().reported).toEqual([]);
  });
});
