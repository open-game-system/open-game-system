import { act, create, type ReactTestInstance } from "react-test-renderer";
import { fakeAirplayDisplay } from "../__fixtures__/fake-airplay";
import { fakeFetch } from "../__fixtures__/fake-fetch";
import { fakeStorage } from "../__fixtures__/fake-storage";
import { createAirplayCastBackend } from "../airplay-cast";
import { castGameStores } from "../cast-stores";
import { createFakeCastBackend } from "../fake-cast";
import { type LinkingLike, OgsShell } from "../OgsShell";
import type { OgsShellConfig } from "../runtime-config";
import { createShellRuntime } from "../shell-runtime";

jest.mock("@open-game-system/app-bridge-react-native", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    BridgedWebView: (props: Record<string, unknown>) => <View testID="bridged" {...props} />,
  };
});
jest.mock("../default-deps", () => ({ defaultShellDeps: () => ({}) }));
jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

// Acceptance: 2026-10-23-airplay-display.feature, "Show on TV with an Apple TV" (a game's own app).
const config: OgsShellConfig = {
  appId: "rocket-crew",
  gameUrl: "https://play.rocketcrew.tv/phone",
  name: "Rocket Crew",
  apiBase: "https://api.test",
  linkDomains: [],
  branding: "hidden",
};

const linking: LinkingLike = {
  getInitialURL: async () => null,
  addEventListener: () => ({ remove: () => {} }),
};
const appState = { currentState: "active", addEventListener: () => ({ remove: () => {} }) };

function makeRuntime(display: ReturnType<typeof fakeAirplayDisplay>) {
  const net = fakeFetch({
    "POST /api/v1/profiles": () => ({
      status: 201,
      body: {
        profile: { id: "g", handle: "player", name: "Player", sticker: "owl" },
        token: "guest",
      },
    }),
    "POST /api/v1/sessions": () => ({ status: 201, body: { sessionId: "s", token: "launcher" } }),
    "POST /api/v1/screens/claim": () => ({
      status: 200,
      body: { screenId: "sc1", name: "Browser TV" },
    }),
    "POST /api/v1/screens/sc1/show": () => ({ status: 204 }),
  });
  const runtime = createShellRuntime(config, {
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
    gameStores: castGameStores(
      createFakeCastBackend({ mode: "none", loadUrl: "https://fake.test/load", fetch: net.fetch }),
      {
        airplay: (ctx) =>
          createAirplayCastBackend({ display: display.display, sheet: ctx.airplaySheet }),
      },
    ),
  });
  return { runtime, calls: net.calls };
}

const find = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => n.props.testID === id && typeof n.type !== "string");
const press = (root: ReactTestInstance, id: string) => {
  const [node] = root.findAll(
    (n) => n.props.testID === id && typeof n.props.onPress === "function",
  );
  if (!node) throw new Error(`nothing to press: ${id}`);
  node.props.onPress();
};
const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!check()) throw new Error("timed out");
};

jest.setTimeout(30000);
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("<OgsShell /> casting to an Apple TV", () => {
  it("the picker offers Apple TV / AirPlay; picking it shows the Screen Mirroring steps until the TV connects", async () => {
    const display = fakeAirplayDisplay({ routes: true });
    const { runtime } = makeRuntime(display);
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(
        <OgsShell config={config} runtime={runtime} linking={linking} appState={appState} />,
      );
    });
    await act(async () => {
      await runtime.idle();
    });
    await act(async () => {
      runtime.bridge.handleWebMessage(
        JSON.stringify({ type: "EVENT", storeKey: "cast", event: { type: "SHOW_CAST_PICKER" } }),
      );
      await until(() => runtime.castPicker.getSnapshot().devices.length > 0);
    });
    expect(find(tree.root, "castPickerDevice-airplay").length).toBeGreaterThan(0);
    // No Chromecast and no browser TV paired: the AirPlay TV is the one on offer, browser TV still there.
    expect(find(tree.root, "browserTvOpen").length).toBeGreaterThan(0);

    await act(async () => {
      press(tree.root, "castPickerDevice-airplay");
      await until(() => runtime.airplaySheet.get().open);
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(find(tree.root, "castPicker")).toHaveLength(0);
    expect(find(tree.root, "showOnTvSheet").length).toBeGreaterThan(0);

    await act(async () => {
      display.connect();
      await until(() => display.calls.length > 0);
    });
    expect(find(tree.root, "showOnTvSheet")).toHaveLength(0);
    expect(display.calls[0]).toBe(
      "start https://ogs-tv.pages.dev/?api=https%3A%2F%2Fapi.test&token=launcher&chrome=none&app=rocket-crew",
    );
  });

  it("Not now closes the steps and the cast is off", async () => {
    const display = fakeAirplayDisplay({ routes: true });
    const { runtime } = makeRuntime(display);
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(
        <OgsShell config={config} runtime={runtime} linking={linking} appState={appState} />,
      );
    });
    await act(async () => {
      runtime.airplaySheet.open();
      await new Promise((r) => setTimeout(r, 400));
    });
    act(() => press(tree.root, "closeShowOnTv"));
    expect(runtime.airplaySheet.get().open).toBe(false);
    expect(find(tree.root, "showOnTvSheet")).toHaveLength(0);
  });
});
