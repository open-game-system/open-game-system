import { createCastStore } from "../cast-store";
import { createCastSwitch, switchMessage, tvRename } from "../cast-switch";

const DEN = { id: "den", name: "Den TV" };
const LIVING = { id: "living", name: "Living room TV" };
const BEDROOM = { id: "bedroom", name: "Bedroom TV" };

function setup(timeoutMs = 1000) {
  const castStore = createCastStore();
  const switched = jest.fn();
  const sw = createCastSwitch({ castStore, timeoutMs, onSwitched: switched });
  const connect = (tv = DEN) =>
    castStore.dispatch({
      type: "SESSION_CONNECTED",
      deviceId: tv.id,
      deviceName: tv.name,
      sessionId: "s",
      streamSessionId: "",
    });
  return { castStore, sw, connect, switched };
}

/** A move that resolves when released (a switchTv still ending the old TV / starting the new). */
function held() {
  let release: (r: "started" | "no-tv" | "same") => void = () => {};
  const move = jest.fn(() => new Promise<"started" | "no-tv" | "same">((r) => (release = r)));
  return { move, release: (r: "started" | "no-tv" | "same") => release(r) };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("TV switch state (Remote → TV picker)", () => {
  it("switching from the tap until the new TV is connected", async () => {
    const t = setup();
    let release: (r: "started") => void = () => {};
    const done = t.sw.run(DEN, () => new Promise((r) => (release = r)));
    expect(t.sw.getSnapshot()).toEqual({ status: "switching", tv: DEN });
    release("started");
    await Promise.resolve();
    expect(t.sw.getSnapshot()).toEqual({ status: "switching", tv: DEN });
    t.connect(DEN);
    await expect(done).resolves.toBe("started");
    expect(t.sw.getSnapshot()).toEqual({ status: "idle" });
  });

  it("already connected when the start resolves (the fake answers at once): done", async () => {
    const t = setup();
    const done = t.sw.run(DEN, async () => {
      t.connect(DEN);
      return "started";
    });
    await expect(done).resolves.toBe("started");
  });

  it("a TV picked while one switch runs is next (last tap wins), never in parallel", async () => {
    const t = setup();
    const toDen = held();
    const toLiving = jest.fn(async () => {
      t.connect(LIVING);
      return "started" as const;
    });
    const first = t.sw.run(DEN, toDen.move);
    const second = t.sw.run(LIVING, toLiving);
    // The phone names the latest pick at once; the second move waits for the first to finish.
    expect(t.sw.getSnapshot()).toEqual({ status: "switching", tv: LIVING });
    await tick();
    expect(toLiving).not.toHaveBeenCalled();
    toDen.release("started");
    t.connect(DEN);
    await expect(first).resolves.toBe("superseded");
    await expect(second).resolves.toBe("started");
    expect(toDen.move).toHaveBeenCalledTimes(1);
    expect(toLiving).toHaveBeenCalledTimes(1);
    expect(t.sw.getSnapshot()).toEqual({ status: "idle" });
    // Only where it ended is named to the couch session.
    expect(t.switched.mock.calls).toEqual([[LIVING]]);
  });

  it("several picks while one runs: only the last runs next", async () => {
    const t = setup();
    const toDen = held();
    const toLiving = jest.fn(async () => "started" as const);
    const toBedroom = jest.fn(async () => {
      t.connect(BEDROOM);
      return "started" as const;
    });
    const first = t.sw.run(DEN, toDen.move);
    const second = t.sw.run(LIVING, toLiving);
    const third = t.sw.run(BEDROOM, toBedroom);
    toDen.release("no-tv");
    await expect(first).resolves.toBe("superseded");
    await expect(second).resolves.toBe("superseded");
    await expect(third).resolves.toBe("started");
    expect(toLiving).not.toHaveBeenCalled();
    expect(t.switched.mock.calls).toEqual([[BEDROOM]]);
  });

  it("picking the TV already being switched to again changes nothing (one switch)", async () => {
    const t = setup();
    const toDen = held();
    const again = jest.fn(async () => "started" as const);
    const first = t.sw.run(DEN, toDen.move);
    const second = t.sw.run(DEN, again);
    expect(t.sw.getSnapshot()).toEqual({ status: "switching", tv: DEN });
    toDen.release("started");
    t.connect(DEN);
    await expect(first).resolves.toBe("started");
    await expect(second).resolves.toBe("started");
    expect(again).not.toHaveBeenCalled();
    expect(t.switched.mock.calls).toEqual([[DEN]]);
  });

  it("changing your mind back to the running TV drops the pick in between", async () => {
    const t = setup();
    const toDen = held();
    const toLiving = jest.fn(async () => "started" as const);
    const first = t.sw.run(DEN, toDen.move);
    const second = t.sw.run(LIVING, toLiving);
    const third = t.sw.run(DEN, async () => "started");
    expect(t.sw.getSnapshot()).toEqual({ status: "switching", tv: DEN });
    toDen.release("started");
    t.connect(DEN);
    await expect(first).resolves.toBe("started");
    await expect(second).resolves.toBe("superseded");
    await expect(third).resolves.toBe("started");
    expect(toLiving).not.toHaveBeenCalled();
  });

  it("a pick after the first switch failed still runs (from the Cast screen's state)", async () => {
    const t = setup();
    const toDen = held();
    const first = t.sw.run(DEN, toDen.move);
    const second = t.sw.run(LIVING, async () => {
      t.connect(LIVING);
      return "started";
    });
    toDen.release("no-tv");
    await expect(first).resolves.toBe("superseded");
    await expect(second).resolves.toBe("started");
    expect(t.sw.getSnapshot()).toEqual({ status: "idle" });
  });

  it("names the TV to the couch session only when a switch connects", async () => {
    const t = setup(20);
    await t.sw.run(DEN, async () => "no-tv");
    await t.sw.run(DEN, async () => "same");
    await t.sw.run(DEN, async () => "started");
    await t.sw.run(DEN, async () => {
      throw new Error("x");
    });
    expect(t.switched).not.toHaveBeenCalled();
    await t.sw.run(DEN, async () => {
      t.connect(DEN);
      return "started";
    });
    expect(t.switched.mock.calls).toEqual([[DEN]]);
  });

  it("no TV: failed, with a clear message and the TV to retry", async () => {
    const t = setup();
    await expect(t.sw.run(DEN, async () => "no-tv")).resolves.toBe("failed");
    const s = t.sw.getSnapshot();
    expect(s).toEqual({ status: "failed", tv: DEN, reason: "no-tv" });
    expect(switchMessage(s)).toBe("Couldn't switch to Den TV. Is it on?");
  });

  it("Cast's own start failure (after the start was accepted): failed with the SDK's words", async () => {
    const t = setup();
    const done = t.sw.run(DEN, async () => "started");
    await Promise.resolve();
    t.castStore.dispatch({ type: "SESSION_STARTING" });
    t.castStore.dispatch({ type: "SESSION_ENDED" });
    t.castStore.dispatch({ type: "SET_ERROR", error: "Couldn't start casting: Launch failed" });
    await expect(done).resolves.toBe("failed");
    expect(switchMessage(t.sw.getSnapshot())).toBe(
      "Couldn't switch to Den TV. Couldn't start casting: Launch failed",
    );
  });

  it("no answer in time: failed (timeout)", async () => {
    const t = setup(20);
    await expect(t.sw.run(DEN, async () => "started")).resolves.toBe("failed");
    expect(t.sw.getSnapshot()).toEqual({ status: "failed", tv: DEN, reason: "timeout" });
    expect(switchMessage(t.sw.getSnapshot())).toBe("Couldn't switch to Den TV. It didn't answer.");
  });

  it("a move that throws: failed with its message", async () => {
    const t = setup();
    await expect(
      t.sw.run(DEN, async () => {
        throw new Error("Network request failed");
      }),
    ).resolves.toBe("failed");
    expect(t.sw.getSnapshot()).toEqual({
      status: "failed",
      tv: DEN,
      reason: "error",
      detail: "Network request failed",
    });
  });

  it("the TV you're on: back to idle at once", async () => {
    const t = setup();
    await expect(t.sw.run(DEN, async () => "same")).resolves.toBe("same");
    expect(t.sw.getSnapshot()).toEqual({ status: "idle" });
  });

  it("a retry after a failure runs, and dismiss clears the failure", async () => {
    const t = setup();
    await t.sw.run(DEN, async () => "no-tv");
    t.sw.dismiss();
    expect(t.sw.getSnapshot()).toEqual({ status: "idle" });
    await t.sw.run(DEN, async () => "no-tv");
    await expect(
      t.sw.run(DEN, async () => {
        t.connect(DEN);
        return "started";
      }),
    ).resolves.toBe("started");
  });

  it("tells subscribers, and stops when they leave", async () => {
    const t = setup();
    const seen = jest.fn();
    const off = t.sw.subscribe(seen);
    await t.sw.run(DEN, async () => "no-tv");
    expect(seen).toHaveBeenCalledTimes(2);
    off();
    t.sw.dismiss();
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("tv.rename for the TV the cast moved to: trimmed, at most 60 characters, none when blank", () => {
    expect(tvRename(" Bedroom TV ")).toEqual({ type: "tv.rename", name: "Bedroom TV" });
    expect(tvRename("T".repeat(70))).toEqual({ type: "tv.rename", name: "T".repeat(60) });
    expect(tvRename("   ")).toBeNull();
  });

  it("idle has no message", () => {
    expect(switchMessage({ status: "idle" })).toBeNull();
    expect(switchMessage({ status: "switching", tv: DEN })).toBeNull();
  });
});
