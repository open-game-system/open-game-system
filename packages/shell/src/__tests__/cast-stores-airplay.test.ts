import { fakeAirplayDisplay } from "../__fixtures__/fake-airplay";
import { fakeFetch } from "../__fixtures__/fake-fetch";
import { fakeStorage } from "../__fixtures__/fake-storage";
import { AIRPLAY_DEVICE_ID, createAirplayCastBackend } from "../airplay-cast";
import { castGameStores } from "../cast-stores";
import { createFakeCastBackend, FAKE_TV } from "../fake-cast";
import { createShellRuntime } from "../shell-runtime";

jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

/**
 * docs/acceptance/2026-10-23-airplay-display.feature: in a game's own app, the AirPlay TV sits next
 * to the Chromecasts, and casting to it shows the same chrome=none launcher a Chromecast would, on
 * the phone's TV window (no stream server).
 */
const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!check()) throw new Error("timed out");
};

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function setup(display: ReturnType<typeof fakeAirplayDisplay>) {
  const net = fakeFetch({
    "POST /api/v1/profiles": () => ({
      status: 201,
      body: {
        profile: { id: "g", handle: "player", name: "Player", sticker: "owl" },
        token: "guest-token",
      },
    }),
    "POST /api/v1/sessions": () => ({
      status: 201,
      body: { sessionId: "s", token: "launcher-token" },
    }),
    "POST /load": () => ({ status: 200, body: {} }),
  });
  const chromecasts = createFakeCastBackend({
    mode: "one",
    loadUrl: "https://fake-cast.test/load",
    fetch: net.fetch,
  });
  const disposed = jest.fn();
  const runtime = createShellRuntime(
    {
      appId: "settlewood",
      gameUrl: "https://settlewood.example/play",
      name: "Settlewood",
      apiBase: "https://api.test",
      tvBase: "https://tv.test",
      linkDomains: [],
      airplay: true,
    },
    {
      fetch: net.fetch,
      storage: fakeStorage().storage,
      device: async () => ({ deviceId: "d", kind: "phone", name: "iPhone" }),
      notifications: {
        getPermissionsAsync: async () => ({ granted: false }),
        requestPermissionsAsync: async () => ({ granted: false }),
        getDevicePushTokenAsync: async () => ({ type: "ios", data: "t" }),
        addPushTokenListener: () => ({ remove: () => {} }),
      },
      platform: "ios",
      apnsEnvironment: async () => "production",
      haptics: { impact: async () => {}, notify: async () => {} },
      signInProviders: [],
      gameStores: castGameStores(chromecasts, {
        streamServerUrl: "https://stream.test",
        airplay: (ctx) => {
          const backend = createAirplayCastBackend({
            display: display.display,
            sheet: ctx.airplaySheet,
          });
          return {
            ...backend,
            dispose: () => {
              disposed();
              backend.dispose();
            },
          };
        },
      }),
    },
  );
  return { runtime, net, disposed };
}

const cast = (runtime: ReturnType<typeof setup>["runtime"], deviceId: string) =>
  runtime.bridge.handleWebMessage(
    JSON.stringify({ type: "EVENT", storeKey: "cast", event: { type: "START_CASTING", deviceId } }),
  );

const LAUNCHER =
  "https://tv.test/?api=https%3A%2F%2Fapi.test&token=launcher-token&chrome=none&app=settlewood";

describe("castGameStores with airplay", () => {
  it("lists the AirPlay TV next to the Chromecast, in the game's cast store and the picker", async () => {
    const display = fakeAirplayDisplay({ display: { name: "Kitchen", width: 1920, height: 1080 } });
    const { runtime } = setup(display);
    await runtime.start();
    const store = runtime.bridge.getStore("cast");
    await until(() => JSON.stringify(store?.getSnapshot()).includes("Kitchen"));
    const names = runtime.castPicker.getSnapshot().devices.map((d) => d.name);
    expect(names).toEqual([FAKE_TV.name, "Kitchen"]);
  });

  it("casting to it shows the chrome=none launcher on the phone's TV window, not the stream", async () => {
    const display = fakeAirplayDisplay({ display: { name: "Kitchen", width: 1920, height: 1080 } });
    const { runtime, net } = setup(display);
    await runtime.start();
    await until(() =>
      JSON.stringify(runtime.bridge.getStore("cast")?.getSnapshot()).includes("Kitchen"),
    );
    cast(runtime, AIRPLAY_DEVICE_ID);
    await until(() => display.calls.length > 0);
    expect(display.calls).toEqual([`start ${LAUNCHER}`]);
    expect(net.calls.some((c) => c.url.includes("fake-cast.test"))).toBe(false);
    await until(() =>
      JSON.stringify(runtime.bridge.getStore("cast")?.getSnapshot()).includes('"connected"'),
    );
  });

  it("with no display yet: the Screen Mirroring sheet opens, and the cast lands once the TV connects", async () => {
    const display = fakeAirplayDisplay({ routes: true });
    const { runtime } = setup(display);
    await runtime.start();
    // The first search finds the receiver.
    await until(() =>
      JSON.stringify(runtime.bridge.getStore("cast")?.getSnapshot()).includes("Apple TV"),
    );
    cast(runtime, AIRPLAY_DEVICE_ID);
    await until(() => runtime.airplaySheet.get().open);
    expect(runtime.airplaySheet.get().mode).toBe("steps");
    display.connect();
    await until(() => display.calls.length > 0);
    expect(display.calls).toEqual([`start ${LAUNCHER}`]);
    expect(runtime.airplaySheet.get().open).toBe(false);
  });

  it("stopping the runtime disposes the AirPlay backend", async () => {
    const display = fakeAirplayDisplay();
    const { runtime, disposed } = setup(display);
    await runtime.start();
    runtime.stop();
    expect(disposed).toHaveBeenCalledTimes(1);
  });
});
