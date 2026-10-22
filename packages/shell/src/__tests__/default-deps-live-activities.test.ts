import { fakeContext } from "../__fixtures__/fake-context";
import { castGameStores } from "../cast-stores";
import { defaultShellDeps } from "../default-deps";
import { shellLiveActivity } from "../live-activity-shell";

jest.mock("expo-device", () => ({ DeviceType: { PHONE: 1, TABLET: 2 }, deviceType: 1 }));
jest.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));
jest.mock("expo-application", () => ({
  getIosPushNotificationServiceEnvironmentAsync: async () => "production",
}));
jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-notifications", () => ({ setNotificationHandler: () => {} }));
jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: {} }));
jest.mock("../google-cast-backend", () => ({ createGoogleCastBackend: jest.fn(() => "backend") }));
const mockCast = { name: "cast" };
const mockOgs = { name: "ogs" };
jest.mock("../cast-stores", () => ({ castGameStores: jest.fn(() => () => ({ cast: mockCast })) }));
jest.mock("../game-stores", () => ({ ogsGameStores: jest.fn(() => () => ({ ogs: mockOgs })) }));
jest.mock("../consent-sheet", () => ({ askToNotify: jest.fn() }));
const mockLive = {
  onSession: jest.fn(),
  attach: jest.fn((stores: object) => ({ ...stores, ogs: "teed" })),
};
jest.mock("../live-activity-shell", () => ({ shellLiveActivity: jest.fn(() => mockLive) }));
jest.mock("../live-activity-native", () => ({ loadLiveActivityNative: () => "native" }));

const config = {
  appId: "settlewood",
  gameUrl: "https://settlewood.example/host",
  name: "Settlewood",
  apiBase: "https://api.test",
  linkDomains: [],
};

afterEach(() => jest.clearAllMocks());

describe("defaultShellDeps with Live Activities on (shell config liveActivities)", () => {
  it("follows the cast and the game's reports, and registers under the cast's session", async () => {
    const { ctx } = fakeContext(async () => new Response(null));
    const stores = defaultShellDeps({ ...config, liveActivities: true }).gameStores?.(ctx);
    expect(stores).toEqual({ cast: mockCast, ogs: "teed" });
    expect(shellLiveActivity).toHaveBeenCalledWith(ctx, {
      native: "native",
      environment: expect.any(Function),
    });
    expect(castGameStores).toHaveBeenCalledWith(
      "backend",
      expect.objectContaining({ onSession: mockLive.onSession }),
    );
    expect(mockLive.attach).toHaveBeenCalledWith({ cast: mockCast, ogs: mockOgs });
    const [[, opts]] = jest.mocked(shellLiveActivity).mock.calls;
    await expect(opts.environment()).resolves.toBe("production");
  });

  it("with the flag off, makes no activity and leaves the stores alone", () => {
    const { ctx } = fakeContext(async () => new Response(null));
    expect(defaultShellDeps(config).gameStores?.(ctx)).toEqual({ cast: mockCast, ogs: mockOgs });
    expect(shellLiveActivity).not.toHaveBeenCalled();
    expect(castGameStores).toHaveBeenCalledWith(
      "backend",
      expect.not.objectContaining({ onSession: expect.anything() }),
    );
  });
});
