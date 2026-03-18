import { createCastSession, deleteCastSession, pushCastStateUpdate } from "../cast-api";

// Mock global fetch
const mockFetch = jest.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

const API_URL = "https://api.opengame.org";
const API_KEY = "test-api-key-123";

describe("cast-api", () => {
  describe("createCastSession", () => {
    it("returns parsed response on success", async () => {
      const responseBody = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        streamSessionId: "stream-abc-123",
        streamUrl: "https://stream.example.com/abc",
        status: "active",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseBody),
      });

      const result = await createCastSession(
        API_URL,
        API_KEY,
        "chromecast-1",
        "https://game.example.com/play",
      );

      expect(result).toEqual(responseBody);

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/api/v1/cast/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          deviceId: "chromecast-1",
          viewUrl: "https://game.example.com/play",
        }),
      });
    });

    it("throws on 502 stream provisioning failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () =>
          Promise.resolve({
            error: {
              code: "stream_provisioning_failed",
              message: "Failed to provision stream container",
              status: 502,
            },
          }),
      });

      await expect(
        createCastSession(API_URL, API_KEY, "chromecast-1", "https://game.example.com/play"),
      ).rejects.toThrow("Failed to provision stream container");
    });

    it("throws on 401 bad auth", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: {
              code: "unauthorized",
              message: "Invalid API key",
              status: 401,
            },
          }),
      });

      await expect(
        createCastSession(API_URL, API_KEY, "chromecast-1", "https://game.example.com/play"),
      ).rejects.toThrow("Invalid API key");
    });

    it("throws on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network request failed"));

      await expect(
        createCastSession(API_URL, API_KEY, "chromecast-1", "https://game.example.com/play"),
      ).rejects.toThrow("Network request failed");
    });
  });

  describe("deleteCastSession", () => {
    it("completes successfully on 200", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ended" }),
      });

      await expect(deleteCastSession(API_URL, API_KEY, "session-123")).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/api/v1/cast/sessions/session-123`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });
    });

    it("throws on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({
            error: {
              code: "session_not_found",
              message: "Cast session not found",
              status: 404,
            },
          }),
      });

      await expect(deleteCastSession(API_URL, API_KEY, "nonexistent-session")).rejects.toThrow(
        "Cast session not found",
      );
    });
  });

  describe("pushCastStateUpdate", () => {
    it("completes successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });

      await expect(
        pushCastStateUpdate(API_URL, API_KEY, "session-123", { round: 3 }),
      ).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/api/v1/cast/sessions/session-123/state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ state: { round: 3 } }),
      });
    });

    it("does not throw on failure (best effort)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        pushCastStateUpdate(API_URL, API_KEY, "session-123", { round: 3 }),
      ).resolves.toBeUndefined();
    });
  });
});
