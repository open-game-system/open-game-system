import type { ClientMessage } from "@open-game-system/ogs-protocol";
import { exitGame } from "../game-exit";
import { swipeBackHandlers } from "../swipe-back";

function setup(ogsCast: boolean, reported = true) {
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

  it("a game that reported nothing is recorded as a visit", () => {
    const t = setup(false, false);
    t.swipe.release(200);
    expect(t.report).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: "visit-rocket-crew", status: "suspended" }),
      "visit",
    );
  });
});
