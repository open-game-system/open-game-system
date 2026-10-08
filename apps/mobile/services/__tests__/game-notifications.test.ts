import { createGameNotifications } from "../game-notifications";

const handle = "ph_abcdefghijklmnop";
const flush = () => new Promise<void>((r) => setImmediate(r));

function setup(over: Partial<Parameters<typeof createGameNotifications>[0]> = {}) {
  const calls: string[] = [];
  const n = createGameNotifications({
    appId: () => "codebreakers",
    gameName: () => "Codebreakers",
    isKidDevice: () => false,
    askPlayer: async (name) => {
      calls.push(`ask:${name}`);
      return true;
    },
    osPermission: async () => true,
    optIn: async (appId, join) => {
      calls.push(`optIn:${appId}:${join ?? ""}`);
      return { status: "granted", handle };
    },
    ...over,
  });
  return { n, calls };
}

describe("the notifications bridge store", () => {
  it("starts with no answer and no push", () => {
    expect(setup().n.store.getSnapshot()).toEqual({ answer: null, last: null });
  });

  it("REQUEST: asks the player, opts in, answers by id", async () => {
    const { n, calls } = setup();
    n.store.dispatch({ type: "REQUEST", id: "r1" });
    await flush();
    expect(calls).toEqual(["ask:Codebreakers", "optIn:codebreakers:"]);
    expect(n.store.getSnapshot().answer).toEqual({
      id: "r1",
      result: { status: "granted", handle },
    });
  });

  it("passes the handle to join", async () => {
    const { n, calls } = setup();
    n.store.dispatch({ type: "REQUEST", id: "r1", handle });
    await flush();
    expect(calls).toContain(`optIn:codebreakers:${handle}`);
  });

  it("Not now: denied, and OGS is never called", async () => {
    const { n, calls } = setup({ askPlayer: async () => false });
    n.store.dispatch({ type: "REQUEST", id: "r2" });
    await flush();
    expect(calls).toEqual([]);
    expect(n.store.getSnapshot().answer).toEqual({ id: "r2", result: { status: "denied" } });
  });

  it("a kid's iPad: denied without asking", async () => {
    const { n, calls } = setup({ isKidDevice: () => true });
    n.store.dispatch({ type: "REQUEST", id: "r3" });
    await flush();
    expect(calls).toEqual([]);
    expect(n.store.getSnapshot().answer?.result).toEqual({ status: "denied" });
  });

  it("notifications off for OGS in the OS: denied, OGS never called", async () => {
    const { n, calls } = setup({ osPermission: async () => false });
    n.store.dispatch({ type: "REQUEST", id: "r4" });
    await flush();
    expect(calls).toEqual(["ask:Codebreakers"]);
    expect(n.store.getSnapshot().answer?.result).toEqual({ status: "denied" });
  });

  it("OGS failing to answer: denied (the game can ask again later)", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { n } = setup({
      optIn: async () => {
        throw new Error("offline");
      },
    });
    n.store.dispatch({ type: "REQUEST", id: "r5" });
    await flush();
    expect(n.store.getSnapshot().answer?.result).toEqual({ status: "denied" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("no game open: denied", async () => {
    const { n, calls } = setup({ appId: () => null });
    n.store.dispatch({ type: "REQUEST", id: "r6" });
    await flush();
    expect(calls).toEqual([]);
    expect(n.store.getSnapshot().answer?.result).toEqual({ status: "denied" });
  });

  it("ignores events that don't parse", async () => {
    const { n, calls } = setup();
    n.store.dispatch({ type: "REQUEST" });
    n.store.dispatch({ type: "NOPE", id: "x" });
    await flush();
    expect(calls).toEqual([]);
    expect(n.store.getSnapshot()).toEqual({ answer: null, last: null });
  });

  it("LISTENING says whether the page handles pushes", () => {
    const { n } = setup();
    expect(n.listening()).toBe(false);
    n.store.dispatch({ type: "LISTENING", on: true });
    expect(n.listening()).toBe(true);
    n.store.dispatch({ type: "LISTENING", on: false });
    expect(n.listening()).toBe(false);
  });

  it("deliver hands the page a push with a growing seq", () => {
    const { n } = setup();
    const seen: unknown[] = [];
    n.store.subscribe((s) => seen.push(s.last?.seq));
    n.deliver({ title: "A", body: "a", url: "https://cb.example/" });
    n.deliver({ title: "B", body: "b", url: "https://cb.example/" });
    expect(n.store.getSnapshot().last).toEqual({
      seq: 2,
      notification: { title: "B", body: "b", url: "https://cb.example/" },
    });
    expect(seen).toContain(1);
  });

  it("reset (a new game screen) forgets the answer, the push and the listener", async () => {
    const { n } = setup();
    n.store.dispatch({ type: "LISTENING", on: true });
    n.store.dispatch({ type: "REQUEST", id: "r7" });
    await flush();
    n.deliver({ title: "A", body: "a", url: "https://cb.example/" });
    n.store.reset();
    expect(n.store.getSnapshot()).toEqual({ answer: null, last: null });
    expect(n.listening()).toBe(false);
    n.deliver({ title: "B", body: "b", url: "https://cb.example/" });
    expect(n.store.getSnapshot().last?.seq).toBe(2); // never restarts at 1
  });
});
