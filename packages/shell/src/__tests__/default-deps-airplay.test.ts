import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { fakeContext } from "../__fixtures__/fake-context";
import { airplayDisplay, airplayNativeLog } from "../airplay-native";
import { shellAirplay } from "../airplay-shell";
import { castGameStores } from "../cast-stores";
import { defaultShellDeps } from "../default-deps";

const mockDevice: { deviceType: number; deviceName: string | null; modelName: string | null } = {
  deviceType: 1,
  deviceName: "Jon's iPhone",
  modelName: "iPhone 16",
};
jest.mock("expo-device", () => ({
  DeviceType: { PHONE: 1, TABLET: 2 },
  get deviceType() {
    return mockDevice.deviceType;
  },
  get deviceName() {
    return mockDevice.deviceName;
  },
  get modelName() {
    return mockDevice.modelName;
  },
}));
let mockUuids = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockUuids}` }));
jest.mock("expo-application", () => ({
  getIosPushNotificationServiceEnvironmentAsync: async () => "development",
}));
const mockSecure = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockSecure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSecure.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockSecure.delete(key);
  },
}));
jest.mock("expo-notifications", () => ({ setNotificationHandler: () => {} }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: async () => null, setItem: async () => {} },
}));
jest.mock("../google-cast-backend", () => ({ createGoogleCastBackend: jest.fn(() => "backend") }));
const mockCastStore = { name: "cast" };
const mockProfileStore = { name: "profile" };
jest.mock("../cast-stores", () => ({
  castGameStores: jest.fn(() => () => ({ cast: mockCastStore })),
}));
jest.mock("../game-stores", () => ({
  ogsGameStores: jest.fn(() => () => ({ profile: mockProfileStore })),
}));
jest.mock("../consent-sheet", () => ({ askToNotify: jest.fn() }));

jest.mock("../airplay-native", () => ({
  airplayDisplay: { available: true },
  airplayNativeLog: { available: true },
}));
jest.mock("../airplay-shell", () => ({ shellAirplay: jest.fn(() => "airplay-factory") }));

// docs/acceptance/2026-10-23-airplay-display.feature, "A game's own app turns AirPlay on in its shell config".
const config = {
  appId: "settlewood",
  gameUrl: "https://settlewood.example/play",
  name: "Settlewood",
  apiBase: "https://api.test",
  linkDomains: [],
};

const realOS = Platform.OS;
afterEach(() => {
  Platform.OS = realOS;
  jest.clearAllMocks();
});

describe("defaultShellDeps: airplay", () => {
  it("airplay on, on iOS: the AirPlay TV joins the cast stores, on the native module", () => {
    Platform.OS = "ios";
    const { ctx } = fakeContext(async () => new Response(null));
    defaultShellDeps({ ...config, airplay: true }).gameStores?.(ctx);
    expect(castGameStores).toHaveBeenCalledWith("backend", {
      browserTvStorage: AsyncStorage,
      airplay: "airplay-factory",
    });
    expect(shellAirplay).toHaveBeenCalledWith(
      expect.objectContaining({ display: airplayDisplay, nativeLog: airplayNativeLog }),
    );
  });

  it("airplay on, on Android: no AirPlay TV", () => {
    Platform.OS = "android";
    const { ctx } = fakeContext(async () => new Response(null));
    defaultShellDeps({ ...config, airplay: true }).gameStores?.(ctx);
    expect(castGameStores).toHaveBeenCalledWith("backend", {
      browserTvStorage: AsyncStorage,
    });
    expect(shellAirplay).not.toHaveBeenCalled();
  });

  it("airplay off: no AirPlay TV", () => {
    Platform.OS = "ios";
    const { ctx } = fakeContext(async () => new Response(null));
    defaultShellDeps(config).gameStores?.(ctx);
    expect(shellAirplay).not.toHaveBeenCalled();
  });
});
