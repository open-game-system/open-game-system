import { extractGameUrl, getInitialGameUrl, addDeepLinkListener } from "../deep-links";
import * as Linking from "expo-linking";

jest.mock("expo-linking", () => ({
  parse: jest.fn(),
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(),
}));

const mockParse = Linking.parse as jest.MockedFunction<typeof Linking.parse>;
const mockGetInitialURL = Linking.getInitialURL as jest.MockedFunction<typeof Linking.getInitialURL>;
const mockAddEventListener = Linking.addEventListener as jest.MockedFunction<typeof Linking.addEventListener>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("deep-links", () => {
  describe("extractGameUrl", () => {
    it("extracts url param from universal link with /open path", () => {
      mockParse.mockReturnValue({
        path: "open",
        queryParams: { url: "https://triviajam.tv/games/abc123" },
        hostname: "opengame.org",
        scheme: "https",
      });

      const result = extractGameUrl("https://opengame.org/open?url=https%3A%2F%2Ftriviajam.tv%2Fgames%2Fabc123");
      expect(result).toBe("https://triviajam.tv/games/abc123");
    });

    it("extracts url param from custom scheme with /open path", () => {
      mockParse.mockReturnValue({
        path: "/open",
        queryParams: { url: "https://triviajam.tv/games/xyz" },
        hostname: null,
        scheme: "myapp",
      });

      const result = extractGameUrl("myapp://open?url=https%3A%2F%2Ftriviajam.tv%2Fgames%2Fxyz");
      expect(result).toBe("https://triviajam.tv/games/xyz");
    });

    it("returns null when path is not /open", () => {
      mockParse.mockReturnValue({
        path: "settings",
        queryParams: { url: "https://triviajam.tv" },
        hostname: null,
        scheme: "myapp",
      });

      expect(extractGameUrl("myapp://settings?url=test")).toBeNull();
    });

    it("returns null when url param is missing", () => {
      mockParse.mockReturnValue({
        path: "open",
        queryParams: {},
        hostname: null,
        scheme: "myapp",
      });

      expect(extractGameUrl("myapp://open")).toBeNull();
    });

    it("returns null when url param is empty string", () => {
      mockParse.mockReturnValue({
        path: "open",
        queryParams: { url: "" },
        hostname: null,
        scheme: "myapp",
      });

      expect(extractGameUrl("myapp://open?url=")).toBeNull();
    });

    it("returns null when parse throws an error", () => {
      mockParse.mockImplementation(() => {
        throw new Error("Invalid URL");
      });

      expect(extractGameUrl("not-a-url")).toBeNull();
    });

    it("returns null gracefully (not via catch) when queryParams is undefined", () => {
      mockParse.mockReturnValue({
        path: "open",
        queryParams: undefined as any,
        hostname: null,
        scheme: "myapp",
      });

      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const result = extractGameUrl("myapp://open");

      expect(result).toBeNull();
      // Should NOT go through the catch path — optional chaining handles it
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("returns null when url param is not a string (array)", () => {
      mockParse.mockReturnValue({
        path: "open",
        queryParams: { url: ["a", "b"] as any },
        hostname: null,
        scheme: "myapp",
      });

      expect(extractGameUrl("myapp://open?url=a&url=b")).toBeNull();
    });
  });

  describe("getInitialGameUrl", () => {
    it("returns game URL when app was launched with a valid deep link", async () => {
      mockGetInitialURL.mockResolvedValue("https://opengame.org/open?url=https%3A%2F%2Ftriviajam.tv");
      mockParse.mockReturnValue({
        path: "open",
        queryParams: { url: "https://triviajam.tv" },
        hostname: "opengame.org",
        scheme: "https",
      });

      const logSpy = jest.spyOn(console, "log").mockImplementation();
      const result = await getInitialGameUrl();
      expect(result).toBe("https://triviajam.tv");
      expect(logSpy).toHaveBeenCalledWith(
        "[DeepLinks] Initial URL:",
        expect.any(String)
      );
      logSpy.mockRestore();
    });

    it("returns null when no initial URL", async () => {
      mockGetInitialURL.mockResolvedValue(null);

      const result = await getInitialGameUrl();
      expect(result).toBeNull();
      expect(mockParse).not.toHaveBeenCalled();
    });

    it("returns null when initial URL is not a game link", async () => {
      mockGetInitialURL.mockResolvedValue("myapp://settings");
      mockParse.mockReturnValue({
        path: "settings",
        queryParams: {},
        hostname: null,
        scheme: "myapp",
      });

      const result = await getInitialGameUrl();
      expect(result).toBeNull();
    });
  });

  describe("addDeepLinkListener", () => {
    it("registers URL event listener and calls callback with game URL", () => {
      const mockSubscription = { remove: jest.fn() };
      let capturedHandler: (event: { url: string }) => void;

      mockAddEventListener.mockImplementation((_event: string, handler: unknown) => {
        capturedHandler = handler as (event: { url: string }) => void;
        return mockSubscription as any;
      });

      const callback = jest.fn();
      const subscription = addDeepLinkListener(callback);

      expect(mockAddEventListener).toHaveBeenCalledWith("url", expect.any(Function));
      expect(subscription).toBe(mockSubscription);

      // Simulate incoming URL
      mockParse.mockReturnValue({
        path: "open",
        queryParams: { url: "https://triviajam.tv/games/live" },
        hostname: "opengame.org",
        scheme: "https",
      });

      capturedHandler!({ url: "https://opengame.org/open?url=https%3A%2F%2Ftriviajam.tv%2Fgames%2Flive" });
      expect(callback).toHaveBeenCalledWith("https://triviajam.tv/games/live");
    });

    it("does not call callback when incoming URL is not a game link", () => {
      let capturedHandler: (event: { url: string }) => void;

      mockAddEventListener.mockImplementation((_event: string, handler: unknown) => {
        capturedHandler = handler as (event: { url: string }) => void;
        return { remove: jest.fn() } as any;
      });

      const callback = jest.fn();
      addDeepLinkListener(callback);

      mockParse.mockReturnValue({
        path: "settings",
        queryParams: {},
        hostname: null,
        scheme: "myapp",
      });

      capturedHandler!({ url: "myapp://settings" });
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
