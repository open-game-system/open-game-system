import * as Linking from "expo-linking";
import { extractGameUrl } from "../deep-links";

jest.mock("expo-linking", () => ({
  parse: jest.fn(),
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(),
}));

const mockParse = Linking.parse as jest.MockedFunction<typeof Linking.parse>;
const mockGetInitialURL = Linking.getInitialURL as jest.MockedFunction<
  typeof Linking.getInitialURL
>;
const mockAddEventListener = Linking.addEventListener as jest.MockedFunction<
  typeof Linking.addEventListener
>;

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

      const result = extractGameUrl(
        "https://opengame.org/open?url=https%3A%2F%2Ftriviajam.tv%2Fgames%2Fabc123",
      );
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

    it("extracts game URL from direct triviajam.tv link", () => {
      mockParse.mockReturnValue({
        path: "games/abc123",
        queryParams: {},
        hostname: "triviajam.tv",
        scheme: "https",
      });

      const result = extractGameUrl("https://triviajam.tv/games/abc123");
      expect(result).toBe("https://triviajam.tv/games/abc123");
    });

    it("extracts game URL from direct triviajam.tv spectate link", () => {
      mockParse.mockReturnValue({
        path: "spectate/abc123",
        queryParams: {},
        hostname: "triviajam.tv",
        scheme: "https",
      });

      const result = extractGameUrl("https://triviajam.tv/spectate/abc123");
      expect(result).toBe("https://triviajam.tv/spectate/abc123");
    });

    it("converts custom scheme game path to triviajam.tv URL", () => {
      mockParse.mockReturnValue({
        path: "games/abc123",
        queryParams: {},
        hostname: null,
        scheme: "myapp",
      });

      const result = extractGameUrl("myapp://games/abc123");
      expect(result).toBe("https://triviajam.tv/games/abc123");
    });

    it("converts custom scheme spectate path to triviajam.tv URL", () => {
      mockParse.mockReturnValue({
        path: "spectate/abc123",
        queryParams: {},
        hostname: null,
        scheme: "myapp",
      });

      const result = extractGameUrl("myapp://spectate/abc123");
      expect(result).toBe("https://triviajam.tv/spectate/abc123");
    });

    it("returns null for triviajam.tv homepage (not a game link)", () => {
      mockParse.mockReturnValue({
        path: "",
        queryParams: {},
        hostname: "triviajam.tv",
        scheme: "https",
      });

      expect(extractGameUrl("https://triviajam.tv/")).toBeNull();
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

  // getInitialGameUrl and addDeepLinkListener were removed 2026-10-08: the root layout routes every
  // link through services/link-routing.ts (catalogue origins, play links), tested there.

  describe("extractGameUrl edges", () => {
    let error: jest.SpyInstance;
    beforeEach(() => {
      error = jest.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => error.mockRestore());

    it("keeps a game domain link whole, query and all", () => {
      mockParse.mockReturnValue({
        path: "games/abc",
        queryParams: { join: "1" },
        hostname: "triviajam.tv",
        scheme: "https",
      });
      expect(extractGameUrl("https://triviajam.tv/games/abc?join=1")).toBe(
        "https://triviajam.tv/games/abc?join=1",
      );
    });

    it("accepts a game path that already starts with a slash", () => {
      mockParse.mockReturnValue({
        path: "/games/abc",
        queryParams: {},
        hostname: "triviajam.tv",
        scheme: "https",
      });
      expect(extractGameUrl("https://triviajam.tv/games/abc?x")).toBe(
        "https://triviajam.tv/games/abc?x",
      );
      mockParse.mockReturnValue({
        path: "/spectate/abc",
        queryParams: {},
        hostname: null,
        scheme: "myapp",
      });
      expect(extractGameUrl("myapp:///spectate/abc")).toBe("https://triviajam.tv/spectate/abc");
    });

    it("a link with no path is not a game, and is not an error", () => {
      mockParse.mockReturnValue({ path: null, queryParams: {}, hostname: null, scheme: "myapp" });
      expect(extractGameUrl("myapp://")).toBeNull();
      mockParse.mockReturnValue({
        path: null,
        queryParams: {},
        hostname: "triviajam.tv",
        scheme: "https",
      });
      expect(extractGameUrl("https://triviajam.tv")).toBeNull();
      expect(error).not.toHaveBeenCalled();
    });

    it("logs a URL it can't parse", () => {
      const err = new Error("Invalid URL");
      mockParse.mockImplementation(() => {
        throw err;
      });
      expect(extractGameUrl("::")).toBeNull();
      expect(error).toHaveBeenCalledWith("[DeepLinks] Failed to parse URL:", err);
    });
  });
});
