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

  it("reset forgets what was reported (a new game screen)", () => {
    const store = createOgsBridgeStore(async () => undefined);
    store.dispatch({ type: "INSTANCE_REPORT", report: { ...report, status: "suspended" } });
    store.reset();
    expect(store.getSnapshot().reported).toEqual([]);
  });
});
