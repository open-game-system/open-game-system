import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExpoPushProvider } from "../src/providers/push";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("ExpoPushProvider", () => {
  let provider: ExpoPushProvider;

  beforeEach(() => {
    provider = new ExpoPushProvider();
    mockFetch.mockReset();
  });

  it("sends a push notification to Expo Push API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ status: "ok", id: "expo-receipt-123" }],
        }),
    });

    const result = await provider.send("ExponentPushToken[abc123]", {
      title: "Your turn!",
      body: "Alex just played.",
    });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe("expo-receipt-123");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body.to).toBe("ExponentPushToken[abc123]");
    expect(body.title).toBe("Your turn!");
    expect(body.body).toBe("Alex just played.");
  });

  it("sends data payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ status: "ok", id: "expo-receipt-456" }],
        }),
    });

    await provider.send("ExponentPushToken[abc123]", {
      title: "Game started",
      body: "Join now!",
      data: { gameId: "game-xyz", action: "join" },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.data).toEqual({ gameId: "game-xyz", action: "join" });
  });

  it("returns failure when Expo returns error status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              status: "error",
              message: "DeviceNotRegistered",
              details: { error: "DeviceNotRegistered" },
            },
          ],
        }),
    });

    const result = await provider.send("ExponentPushToken[invalid]", {
      title: "Test",
      body: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("DeviceNotRegistered");
    expect(result.deviceActive).toBe(false);
  });

  it("marks device as active for non-device errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              status: "error",
              message: "MessageTooBig",
              details: { error: "MessageTooBig" },
            },
          ],
        }),
    });

    const result = await provider.send("ExponentPushToken[abc123]", {
      title: "Test",
      body: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.deviceActive).toBe(true);
  });

  it("returns failure when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await provider.send("ExponentPushToken[abc123]", {
      title: "Test",
      body: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network error");
  });

  it("sends with Expo access token when provided", async () => {
    const authedProvider = new ExpoPushProvider("expo-access-token-xyz");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ status: "ok", id: "expo-receipt-789" }],
        }),
    });

    await authedProvider.send("ExponentPushToken[abc123]", {
      title: "Test",
      body: "Test",
    });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer expo-access-token-xyz");
  });
});
