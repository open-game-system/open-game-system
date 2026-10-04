import { castTarget, createLastStop } from "../last-stop";

const living = { id: "tv-1", name: "Living room TV", type: "chromecast" as const };
const bedroom = { id: "tv-2", name: "Bedroom TV", type: "chromecast" as const };

describe("lastStop: the TV the phone just stopped casting to", () => {
  it("starts empty", () => {
    expect(createLastStop().get()).toBeNull();
  });

  it("remembers the TV on stop and tells listeners; cleared when casting again", () => {
    const store = createLastStop();
    const seen = jest.fn();
    const off = store.subscribe(seen);
    store.stopped({ id: "tv-2", name: "Bedroom TV" });
    expect(store.get()).toEqual({ id: "tv-2", name: "Bedroom TV" });
    store.clear();
    expect(store.get()).toBeNull();
    expect(seen).toHaveBeenCalledTimes(2);
    off();
    store.stopped({ id: "tv-1", name: "Living room TV" });
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("clearing an empty store tells no one", () => {
    const store = createLastStop();
    const seen = jest.fn();
    store.subscribe(seen);
    store.clear();
    expect(seen).not.toHaveBeenCalled();
  });
});

describe("castTarget: which TV the Cast button casts to", () => {
  it("the TV you picked wins", () => {
    expect(castTarget([living, bedroom], bedroom, { id: "tv-1", name: "x" })).toBe(bedroom);
  });
  it("then the TV you just stopped (Cast again goes back to it)", () => {
    expect(castTarget([living, bedroom], null, { id: "tv-2", name: "Bedroom TV" })).toBe(bedroom);
  });
  it("then the first TV found", () => {
    expect(castTarget([living, bedroom], null, null)).toBe(living);
    expect(castTarget([living], null, { id: "gone", name: "Gone TV" })).toBe(living);
  });
  it("nothing found: none", () => {
    expect(castTarget([], null, null)).toBeNull();
  });
});
