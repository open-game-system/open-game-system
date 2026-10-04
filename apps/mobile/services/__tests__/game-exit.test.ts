import type { ClientMessage } from "@open-game-system/ogs-protocol";
import { exitGame } from "../game-exit";
import { swipeBackHandlers } from "../swipe-back";

function setup(ogsCast: boolean, reported = true, instanceId?: string) {
  const sent: ClientMessage[] = [];
  const report = jest.fn(async () => undefined);
  const setPill = jest.fn();
  const goBack = jest.fn();
  const swipe = swipeBackHandlers({
    edge: 30,
    threshold: 140,
    width: 400,
    follow: () => {},
    settle: (_to, done) => done?.(),
    onBack: () =>
      exitGame({
        appId: "rocket-crew",
        name: "Rocket Crew",
        url: "https://rc.example/",
        ogsCast,
        reported,
        now: 1,
        instanceId,
        send: (m) => sent.push(m),
        report,
        setPill,
        goBack,
      }),
  });
  return { swipe, sent, report, setPill, goBack };
}

describe("swipe back from a game (spec v3: swipe back = home; a cancelled swipe sends nothing)", () => {
  it("a completed swipe while cast sends home, leaves the pill and goes back", () => {
    const t = setup(true);
    t.swipe.move(200);
    t.swipe.release(200);
    expect(t.sent).toEqual([{ type: "home" }]);
    expect(t.setPill).toHaveBeenCalledWith(expect.objectContaining({ appId: "rocket-crew" }));
    expect(t.goBack).toHaveBeenCalled();
  });

  it("an unreported game's visit is recorded under the sitting the screen holds", () => {
    const t = setup(true, false, "rocket-crew-abc");
    t.swipe.release(200);
    expect(t.report).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: "rocket-crew-abc" }),
      "visit",
    );
    expect(t.setPill).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: "rocket-crew-abc" }),
    );
  });

  it("a cancelled swipe (released short) sends nothing", () => {
    const t = setup(true);
    t.swipe.move(60);
    t.swipe.release(60);
    expect(t.sent).toEqual([]);
    expect(t.goBack).not.toHaveBeenCalled();
  });

  it("a swipe taken over by another gesture sends nothing", () => {
    const t = setup(true);
    t.swipe.move(100);
    t.swipe.terminate();
    expect(t.sent).toEqual([]);
  });

  it("a completed swipe when not cast sends nothing to the session", () => {
    const t = setup(false);
    t.swipe.release(200);
    expect(t.sent).toEqual([]);
    expect(t.goBack).toHaveBeenCalled();
  });

  it("a reported game records no visit", () => {
    const t = setup(false, true);
    t.swipe.release(200);
    expect(t.report).not.toHaveBeenCalled();
    expect(t.goBack).toHaveBeenCalled();
  });

  it("a visit that can't be recorded is logged, and the exit still completes", async () => {
    const t = setup(false, false);
    const err = new Error("offline");
    t.report.mockRejectedValueOnce(err);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    t.swipe.release(200);
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledWith("[ogs] could not record the visit:", err);
    expect(t.goBack).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("a game that reported nothing is recorded as a visit", () => {
    const t = setup(false, false);
    t.swipe.release(200);
    expect(t.report).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: "visit-rocket-crew", status: "suspended" }),
      "visit",
    );
  });
});
