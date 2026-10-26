import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { fakeContext } from "../__fixtures__/fake-context";
import { airplayDisplay, airplayNativeLog } from "../airplay-native";
import { shellAirplay } from "../airplay-shell";
import { castGameStores } from "../cast-stores";
import { streamServerUrl } from "../cast-view";
import { defaultShellDeps } from "../default-deps";

/**
 * The couch opener default-deps hands castGameStores: it must open a real WebSocket to the couch
 * session's URL, so a game's declared TV page reaches the session as game.start + game.view
 * (single-cast-view.test.ts covers the messages themselves).
 */
const COUCH_URL = "wss://api.test/api/v1/couch/ws?token=t&session=s";
function expectOpensCouchWebSocket(openCouch: unknown) {
  const opened: string[] = [];
  const real = globalThis.WebSocket;
  class FakeWebSocket {
    constructor(readonly url: string) {
      opened.push(url);
    }
  }
  Object.defineProperty(globalThis, "WebSocket", {
    value: FakeWebSocket,
    configurable: true,
    writable: true,
  });
  try {
    if (typeof openCouch !== "function") throw new Error("castGameStores got no openCouch");
    expect(openCouch(COUCH_URL)).toBeInstanceOf(FakeWebSocket);
    expect(opened).toEqual([COUCH_URL]);
  } finally {
    Object.defineProperty(globalThis, "WebSocket", {
      value: real,
      configurable: true,
      writable: true,
    });
  }
}

/** The options of castGameStores' latest call. */
function castOptions() {
  const call = jest.mocked(castGameStores).mock.lastCall;
  if (!call) throw new Error("castGameStores was not called");
  return call[1];
}

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
      streamServerUrl: streamServerUrl({}, config.apiBase),
      browserTvStorage: AsyncStorage,
      airplay: "airplay-factory",
      openCouch: expect.any(Function),
    });
    expectOpensCouchWebSocket(castOptions().openCouch);
    expect(shellAirplay).toHaveBeenCalledWith(
      expect.objectContaining({ display: airplayDisplay, nativeLog: airplayNativeLog }),
    );
  });

  it("airplay on, on Android: no AirPlay TV", () => {
    Platform.OS = "android";
    const { ctx } = fakeContext(async () => new Response(null));
    defaultShellDeps({ ...config, airplay: true }).gameStores?.(ctx);
    expect(castGameStores).toHaveBeenCalledWith("backend", {
      streamServerUrl: streamServerUrl({}, config.apiBase),
      browserTvStorage: AsyncStorage,
      openCouch: expect.any(Function),
    });
    expectOpensCouchWebSocket(castOptions().openCouch);
    expect(shellAirplay).not.toHaveBeenCalled();
  });

  it("airplay off: no AirPlay TV", () => {
    Platform.OS = "ios";
    const { ctx } = fakeContext(async () => new Response(null));
    defaultShellDeps(config).gameStores?.(ctx);
    expect(shellAirplay).not.toHaveBeenCalled();
  });
});
