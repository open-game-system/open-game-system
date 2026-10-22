import { readRuntimeConfig } from "../runtime-config";
import { createShellRuntime } from "../shell-runtime";

const config = readRuntimeConfig({
  name: "Rocket Crew",
  scheme: "rc",
  extra: { ogsShell: { appId: "rocket-crew", gameUrl: "https://play.rocketcrew.tv/phone" } },
});
const runtime = createShellRuntime(config, {
  fetch: async () => new Response("{}"),
  storage: {
    getItemAsync: async () => null,
    setItemAsync: async () => {},
    deleteItemAsync: async () => {},
  },
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
});

describe("a Live Activity tap in a game's own app", () => {
  it("opens nothing new: the app comes forward on the controller as it was", () => {
    expect(runtime.webViewUrlFor("rc://live-activity/rocket-crew")).toBeNull();
  });

  it("other scheme links still open on the game", () => {
    expect(runtime.webViewUrlFor("rc://play/rocket-crew/join/ABCD")).toBe(
      "https://play.rocketcrew.tv/join/ABCD",
    );
    expect(runtime.webViewUrlFor("rc://live-activities")).toBe(
      "https://play.rocketcrew.tv/live-activities",
    );
  });
});
