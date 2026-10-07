import { createCastStore } from "../cast-store";
import { createCastSwitch, switchMessage } from "../cast-switch";

const DEN = { id: "den", name: "Den TV" };
const LIVING = { id: "living", name: "Living room TV" };

function setup(timeoutMs = 1000) {
  const castStore = createCastStore();
  const sw = createCastSwitch({ castStore, timeoutMs });
  const connect = (tv = DEN) =>
    castStore.dispatch({
      type: "SESSION_CONNECTED",
      deviceId: tv.id,
      deviceName: tv.name,
      sessionId: "s",
      streamSessionId: "",
    });
  return { castStore, sw, connect };
}

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

  it("a second tap while one switch runs is ignored (busy): one switch at a time", async () => {
    const t = setup();
    const move = jest.fn(async () => {
      t.connect(DEN);
      return "started" as const;
    });
    const first = t.sw.run(DEN, move);
    const second = t.sw.run(LIVING, move);
    await expect(second).resolves.toBe("busy");
    await expect(first).resolves.toBe("started");
    expect(move).toHaveBeenCalledTimes(1);
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

  it("idle has no message", () => {
    expect(switchMessage({ status: "idle" })).toBeNull();
    expect(switchMessage({ status: "switching", tv: DEN })).toBeNull();
  });
});
