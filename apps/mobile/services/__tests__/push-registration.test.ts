import { startPushRegistration } from "../push-registration";

/** Registering this phone for pushes once its OGS profile exists (and again if the device changes). */
function harness(initial: string | null) {
  let deviceId = initial;
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  const stop = startPushRegistration({
    deviceId: () => deviceId,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    register: async (id) => {
      calls.push(`register:${id}`);
    },
    listen: (id) => {
      calls.push(`listen:${id}`);
      return { remove: () => calls.push(`unlisten:${id}`) };
    },
  });
  const change = (id: string | null) => {
    deviceId = id;
    for (const l of listeners) l();
  };
  return { calls, change, stop, listeners };
}

describe("push registration", () => {
  it("registers at once when the profile already exists", () => {
    expect(harness("dev-1").calls).toEqual(["register:dev-1", "listen:dev-1"]);
  });

  it("waits for the profile, then registers once", () => {
    const h = harness(null);
    expect(h.calls).toEqual([]);
    h.change("dev-1");
    h.change("dev-1");
    expect(h.calls).toEqual(["register:dev-1", "listen:dev-1"]);
  });

  it("a new device id (signed in elsewhere) registers again and drops the old listener", () => {
    const h = harness("dev-1");
    h.change("dev-2");
    expect(h.calls).toEqual([
      "register:dev-1",
      "listen:dev-1",
      "unlisten:dev-1",
      "register:dev-2",
      "listen:dev-2",
    ]);
  });

  it("signed out: stops listening", () => {
    const h = harness("dev-1");
    h.change(null);
    expect(h.calls).toEqual(["register:dev-1", "listen:dev-1", "unlisten:dev-1"]);
  });

  it("stop removes the listener and stops following the profile", () => {
    const h = harness("dev-1");
    h.stop();
    expect(h.calls).toEqual(["register:dev-1", "listen:dev-1", "unlisten:dev-1"]);
    expect(h.listeners.size).toBe(0);
  });

  it("a failed registration is logged, not thrown", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    startPushRegistration({
      deviceId: () => "dev-1",
      subscribe: () => () => {},
      register: async () => {
        throw new Error("offline");
      },
      listen: () => ({ remove: () => {} }),
    });
    await new Promise<void>((r) => setImmediate(r));
    expect(warn).toHaveBeenCalledWith(
      "[Notifications] Push registration failed:",
      expect.any(Error),
    );
    warn.mockRestore();
  });
});
