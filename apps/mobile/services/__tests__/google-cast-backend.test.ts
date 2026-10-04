jest.mock("react-native-google-cast", () => {
  const discovery = {
    onDevicesUpdated: jest.fn(),
    startDiscovery: jest.fn(),
    getDevices: jest.fn(),
  };
  const sessionManager = { name: "the real session manager" };
  return {
    __esModule: true,
    default: {
      getDiscoveryManager: () => discovery,
      getSessionManager: () => sessionManager,
      showCastDialog: jest.fn(async () => true),
    },
  };
});

import GoogleCast from "react-native-google-cast";
import { createGoogleCastBackend } from "../google-cast-backend";

const discovery = GoogleCast.getDiscoveryManager();
const startDiscovery = jest.mocked(discovery.startDiscovery);
const getDevices = jest.mocked(discovery.getDevices);
const onDevicesUpdated = jest.mocked(discovery.onDevicesUpdated);
const flush = () => new Promise((r) => setTimeout(r, 0));
const found = (deviceId: string, friendlyName: string) => ({
  deviceId,
  friendlyName,
  capabilities: [],
  deviceVersion: "1",
  icons: [],
  ipAddress: "10.0.0.2",
  modelName: "Chromecast",
});

beforeEach(() => jest.clearAllMocks());

describe("the real Google Cast backend", () => {
  it("lists what discovery finds, as Chromecasts, and tells subscribers", async () => {
    const backend = createGoogleCastBackend();
    expect(backend.getDevices()).toEqual([]);
    const seen = jest.fn();
    backend.subscribeDevices(seen);
    startDiscovery.mockResolvedValue(undefined);
    getDevices.mockResolvedValue([found("cc-1", "Den TV")]);
    backend.startDiscovery();
    await flush();
    const den = [{ id: "cc-1", name: "Den TV", type: "chromecast" }];
    expect(backend.getDevices()).toEqual(den);
    expect(seen).toHaveBeenCalledWith(den);
  });

  it("follows discovery updates, until a subscriber leaves", () => {
    const backend = createGoogleCastBackend();
    const publish = onDevicesUpdated.mock.calls[0]?.[0];
    const seen = jest.fn();
    const off = backend.subscribeDevices(seen);
    publish?.([found("cc-2", "Kitchen")]);
    expect(backend.getDevices()).toEqual([{ id: "cc-2", name: "Kitchen", type: "chromecast" }]);
    off();
    publish?.([]);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("a discovery that fails keeps the last list quietly", async () => {
    const backend = createGoogleCastBackend();
    startDiscovery.mockRejectedValue(new Error("no wifi"));
    backend.startDiscovery();
    await flush();
    expect(getDevices).not.toHaveBeenCalled();
    expect(backend.getDevices()).toEqual([]);
  });

  it("uses the real session manager and the native picker", () => {
    const backend = createGoogleCastBackend();
    expect(backend.sessionManager).toBe(GoogleCast.getSessionManager());
    backend.showCastDialog();
    expect(GoogleCast.showCastDialog).toHaveBeenCalledTimes(1);
  });
});
