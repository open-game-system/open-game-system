import { describe, expect, it } from "vitest";
import { createFakeClient } from "./fake-client";

const NOW = new Date(2026, 9, 3, 19, 10).getTime();
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("fake couch session", () => {
  it("connects at once by default with the household seeded", () => {
    const c = createFakeClient({ now: () => NOW });
    const { state, connection } = c.getSnapshot();
    expect(connection).toBe("open");
    expect(state?.cast).toBe(true);
    expect(state?.casts).toBe(1);
    expect(state?.remote).toBe("jonathan-phone");
    expect(state?.suspended.map((g) => [g.appId, g.label])).toEqual([["bake-shop", "Day 4"]]);
    expect(state?.screen).toBe("home");
  });

  it("holds in connecting until connect() when asked", () => {
    const c = createFakeClient({ now: () => NOW, hold: true });
    expect(c.getSnapshot()).toEqual({ state: null, connection: "connecting" });
    c.connect();
    expect(c.getSnapshot().connection).toBe("open");
  });

  it("runs the protocol reducer on sends", () => {
    const c = createFakeClient({ now: () => NOW });
    c.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    expect(c.getSnapshot().state?.screen).toBe("game");
    expect(c.getSnapshot().state?.current?.hostDeviceId).toBe("jonathan-phone");
  });

  it("routes focus.move to the launcher asynchronously", async () => {
    const c = createFakeClient({ now: () => NOW });
    const dirs: string[] = [];
    c.onFocusMove((d) => dirs.push(d));
    c.send({ type: "focus.move", dir: "down" });
    expect(dirs).toEqual([]);
    await tick();
    expect(dirs).toEqual(["down"]);
  });

  it("drops to reconnecting keeping state, and ignores sends until restored", () => {
    const c = createFakeClient({ now: () => NOW });
    const before = c.getSnapshot().state;
    c.drop();
    expect(c.getSnapshot()).toEqual({ state: before, connection: "reconnecting" });
    c.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    expect(c.getSnapshot().state?.screen).toBe("home");
    c.restore();
    expect(c.getSnapshot().connection).toBe("open");
  });

  it("notifies subscribers", () => {
    const c = createFakeClient({ now: () => NOW });
    let n = 0;
    c.subscribe(() => n++);
    c.send({ type: "focus.set", itemId: "game:rocket-crew" });
    expect(n).toBe(1);
  });
});
