jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

import { createCastStore } from "../cast-store";
import { castCommands, startCastSync } from "../cast-sync";
import { createFakeCastBackend, FAKE_TV } from "../fake-cast";

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(mode: "one" | "none" = "one") {
  const posts: { url: string; body: unknown }[] = [];
  const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
    posts.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response("{}", { status: 200 });
  });
  const backend = createFakeCastBackend({
    mode,
    loadUrl: "http://fake.test/load",
    fetch: fetchImpl,
  });
  return { backend, posts };
}

describe("fake cast for the simulator (EXPO_PUBLIC_FAKE_CAST)", () => {
  it("=1 discovers one simulated living room TV", async () => {
    const { backend } = setup();
    const seen = jest.fn();
    backend.subscribeDevices(seen);
    backend.startDiscovery();
    await flush();
    expect(backend.getDevices()).toEqual([FAKE_TV]);
    expect(FAKE_TV.name).toBe("Living room TV (simulated)");
    expect(seen).toHaveBeenCalledWith([FAKE_TV]);
  });

  it("=none finds no TV at all", async () => {
    const { backend } = setup("none");
    backend.startDiscovery();
    await flush();
    expect(backend.getDevices()).toEqual([]);
    await expect(backend.sessionManager.startSession(FAKE_TV.id)).resolves.toBe(false);
  });

  it("starting a session loads the view by POSTing it to the fake Chromecast", async () => {
    const { backend, posts } = setup();
    const store = createCastStore();
    const commands = castCommands();
    startCastSync(store, backend.sessionManager, commands, "https://stream.test");
    store.dispatch({ type: "SET_VIEW_URL", url: "http://localhost:5180/?api=a&token=t" });
    await backend.sessionManager.startSession(FAKE_TV.id);
    await flush();
    await flush();
    expect(store.getSnapshot().session).toMatchObject({
      status: "connected",
      deviceName: "Living room TV (simulated)",
    });
    expect(posts).toEqual([
      { url: "http://fake.test/load", body: { viewUrl: "http://localhost:5180/?api=a&token=t" } },
    ]);
  });

  it("an existing session is picked up when sync starts (app reopened while cast)", async () => {
    const { backend } = setup();
    await backend.sessionManager.startSession(FAKE_TV.id);
    const store = createCastStore();
    startCastSync(store, backend.sessionManager, castCommands(), "s");
    await flush();
    await flush();
    expect(store.getSnapshot().session.status).toBe("connected");
  });

  it("ending the session disconnects the store", async () => {
    const { backend } = setup();
    const store = createCastStore();
    startCastSync(store, backend.sessionManager, castCommands(), "s");
    await backend.sessionManager.startSession(FAKE_TV.id);
    await flush();
    await backend.sessionManager.endCurrentSession(true);
    expect(store.getSnapshot().session.status).toBe("disconnected");
    await expect(backend.sessionManager.getCurrentCastSession()).resolves.toBeNull();
  });

  it("a load the fake Chromecast can't take is logged, not thrown", async () => {
    const backend = createFakeCastBackend({
      mode: "one",
      loadUrl: "http://fake.test/load",
      fetch: async () => {
        throw new TypeError("offline");
      },
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const store = createCastStore();
    startCastSync(store, backend.sessionManager, castCommands(), "s");
    store.dispatch({ type: "SET_VIEW_URL", url: "http://x/" });
    await backend.sessionManager.startSession(FAKE_TV.id);
    await flush();
    await flush();
    expect(store.getSnapshot().session.status).toBe("connected");
    warn.mockRestore();
  });
});
