import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  addTracks,
  renegotiate,
  closeTracks,
  type RealtimeSessionResponse,
  type RealtimeTrackInfo,
} from "../src/lib/realtime";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const APP_ID = "test-app-id";
const APP_SECRET = "test-app-secret";
const BASE_URL = `https://rtc.live.cloudflare.com/v1/apps/${APP_ID}/sessions`;

describe("Realtime SFU API client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("createSession", () => {
    it("creates a session with an SDP offer and returns session response", async () => {
      const mockResponse: RealtimeSessionResponse = {
        sessionId: "session-123",
        sessionDescription: {
          type: "answer",
          sdp: "v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const offer = {
        type: "offer" as const,
        sdp: "v=0\r\no=- 456 2 IN IP4 127.0.0.1\r\n",
      };

      const result = await createSession(
        { appId: APP_ID, appSecret: APP_SECRET },
        offer
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/new`);
      expect(opts.method).toBe("POST");
      expect(opts.headers["Authorization"]).toBe(`Bearer ${APP_SECRET}`);
      expect(opts.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(opts.body);
      expect(body.sessionDescription).toEqual(offer);
    });

    it("throws on non-ok response with error details", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request: invalid SDP"),
      });

      const offer = { type: "offer" as const, sdp: "invalid" };

      await expect(
        createSession({ appId: APP_ID, appSecret: APP_SECRET }, offer)
      ).rejects.toThrow("Realtime API createSession failed: 400 — Bad Request: invalid SDP");
    });
  });

  describe("addTracks", () => {
    it("adds tracks to an existing session and returns updated session", async () => {
      const tracks: RealtimeTrackInfo[] = [
        { location: "local", trackName: "cast-video", mid: "0" },
        { location: "local", trackName: "cast-audio", mid: "1" },
      ];

      const mockResponse: RealtimeSessionResponse = {
        sessionId: "session-123",
        sessionDescription: {
          type: "answer",
          sdp: "v=0\r\nanswer-sdp\r\n",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const renegotiationSdp = {
        type: "offer" as const,
        sdp: "v=0\r\nrenegotiation-offer\r\n",
      };

      const result = await addTracks(
        { appId: APP_ID, appSecret: APP_SECRET },
        "session-123",
        { sessionDescription: renegotiationSdp, tracks }
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/session-123/tracks/new`);
      expect(opts.method).toBe("POST");
      expect(opts.headers["Authorization"]).toBe(`Bearer ${APP_SECRET}`);

      const body = JSON.parse(opts.body);
      expect(body.sessionDescription).toEqual(renegotiationSdp);
      expect(body.tracks).toEqual(tracks);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Session not found"),
      });

      await expect(
        addTracks(
          { appId: APP_ID, appSecret: APP_SECRET },
          "session-123",
          {
            sessionDescription: { type: "offer", sdp: "x" },
            tracks: [],
          }
        )
      ).rejects.toThrow("Realtime API addTracks failed: 404 — Session not found");
    });
  });

  describe("renegotiate", () => {
    it("sends an SDP answer for renegotiation", async () => {
      const mockResponse: RealtimeSessionResponse = {
        sessionId: "session-123",
        sessionDescription: {
          type: "answer",
          sdp: "v=0\r\nfinal-answer\r\n",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const answer = {
        type: "answer" as const,
        sdp: "v=0\r\nclient-answer\r\n",
      };

      const result = await renegotiate(
        { appId: APP_ID, appSecret: APP_SECRET },
        "session-123",
        answer
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/session-123/renegotiate`);
      expect(opts.method).toBe("PUT");
      expect(opts.headers["Authorization"]).toBe(`Bearer ${APP_SECRET}`);

      const body = JSON.parse(opts.body);
      expect(body.sessionDescription).toEqual(answer);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(
        renegotiate(
          { appId: APP_ID, appSecret: APP_SECRET },
          "session-123",
          { type: "answer", sdp: "x" }
        )
      ).rejects.toThrow("Realtime API renegotiate failed: 500 — Internal Server Error");
    });
  });

  describe("closeTracks", () => {
    it("closes specified tracks by name", async () => {
      const mockResponse = {
        tracks: [
          { trackName: "cast-video", status: "closed" },
          { trackName: "cast-audio", status: "closed" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await closeTracks(
        { appId: APP_ID, appSecret: APP_SECRET },
        "session-123",
        ["cast-video", "cast-audio"]
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/session-123/tracks/close`);
      expect(opts.method).toBe("PUT");
      expect(opts.headers["Authorization"]).toBe(`Bearer ${APP_SECRET}`);

      const body = JSON.parse(opts.body);
      expect(body.tracks).toEqual([
        { trackName: "cast-video" },
        { trackName: "cast-audio" },
      ]);
      expect(body.force).toBe(true);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Invalid track names"),
      });

      await expect(
        closeTracks(
          { appId: APP_ID, appSecret: APP_SECRET },
          "session-123",
          ["nonexistent"]
        )
      ).rejects.toThrow("Realtime API closeTracks failed: 400 — Invalid track names");
    });
  });

  describe("response parsing", () => {
    it("validates createSession response has required fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ unexpected: "shape" }),
        text: () => Promise.resolve(JSON.stringify({ unexpected: "shape" })),
      });

      await expect(
        createSession(
          { appId: APP_ID, appSecret: APP_SECRET },
          { type: "offer", sdp: "x" }
        )
      ).rejects.toThrow("sessionId must be a non-empty string");
    });

    it("validates sessionDescription in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            sessionId: "session-123",
            sessionDescription: "not-an-object",
          }),
        text: () =>
          Promise.resolve(
            JSON.stringify({
              sessionId: "session-123",
              sessionDescription: "not-an-object",
            })
          ),
      });

      await expect(
        createSession(
          { appId: APP_ID, appSecret: APP_SECRET },
          { type: "offer", sdp: "x" }
        )
      ).rejects.toThrow("sessionDescription must be an object");
    });
  });
});
