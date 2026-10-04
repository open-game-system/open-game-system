import { swipeBackHandlers } from "../swipe-back";

function setup() {
  const moves: number[] = [];
  const settles: number[] = [];
  const back = jest.fn();
  const h = swipeBackHandlers({
    edge: 24,
    threshold: 140,
    width: 400,
    follow: (dx) => moves.push(dx),
    settle: (to, done) => {
      settles.push(to);
      done?.();
    },
    onBack: back,
  });
  return { h, moves, settles, back };
}

describe("swipe-back gesture", () => {
  it("only starts at the left edge", () => {
    const { h } = setup();
    expect(h.startsAt(10)).toBe(true);
    expect(h.startsAt(200)).toBe(false);
  });

  it("follows the finger rightward only", () => {
    const { h, moves } = setup();
    h.move(30);
    h.move(-10);
    expect(moves).toEqual([30]);
  });

  it("goes back past the threshold", () => {
    const { h, settles, back } = setup();
    h.release(200);
    expect(settles).toEqual([400]);
    expect(back).toHaveBeenCalled();
  });

  it("snaps home when released short", () => {
    const { h, settles, back } = setup();
    h.release(60);
    expect(settles).toEqual([0]);
    expect(back).not.toHaveBeenCalled();
  });

  it("snaps home when another gesture takes over mid-drag (the view must not stay shifted)", () => {
    const { h, settles, back } = setup();
    h.move(30);
    h.terminate();
    expect(settles).toEqual([0]);
    expect(back).not.toHaveBeenCalled();
  });
});

describe("swipe-back thresholds", () => {
  const make = () => {
    const follow = jest.fn();
    const settle = jest.fn();
    const onBack = jest.fn();
    const h = swipeBackHandlers({ edge: 30, threshold: 140, width: 400, follow, settle, onBack });
    return { h, follow, settle, onBack };
  };

  it("starts only inside the edge, not on it", () => {
    const { h } = make();
    expect(h.startsAt(29)).toBe(true);
    expect(h.startsAt(30)).toBe(false);
  });

  it("follows only a drag to the right", () => {
    const { h, follow } = make();
    h.move(0);
    expect(follow).not.toHaveBeenCalled();
    h.move(1);
    expect(follow).toHaveBeenCalledWith(1);
  });

  it("goes back only past the threshold", () => {
    const { h, settle } = make();
    h.release(140);
    expect(settle).toHaveBeenLastCalledWith(0);
    h.release(141);
    expect(settle).toHaveBeenLastCalledWith(400, expect.any(Function));
  });
});
