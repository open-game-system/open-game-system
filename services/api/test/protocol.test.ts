import { describe, it, expect } from "vitest";
import {
  parseSessionDescription,
  parseTrackInfo,
  parsePublisherPrepareRequest,
  parsePublisherPrepareResponse,
  parsePublisherAnswerRequest,
  parseSubscribeRequest,
  parseSubscribeResponse,
  parseSubscribeAnswerRequest,
} from "../src/protocol";

// ---------- parseSessionDescription ----------

describe("parseSessionDescription", () => {
  it("parses a valid offer", () => {
    const result = parseSessionDescription({
      type: "offer",
      sdp: "v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n",
    });
    expect(result).toEqual({
      type: "offer",
      sdp: "v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n",
    });
  });

  it("parses a valid answer", () => {
    const result = parseSessionDescription({
      type: "answer",
      sdp: "v=0\r\n",
    });
    expect(result).toEqual({ type: "answer", sdp: "v=0\r\n" });
  });

  it("throws for non-object input", () => {
    expect(() => parseSessionDescription("not an object")).toThrow(
      "sessionDescription must be an object"
    );
  });

  it("throws for null input", () => {
    expect(() => parseSessionDescription(null)).toThrow(
      "sessionDescription must be an object"
    );
  });

  it("throws for invalid type", () => {
    expect(() =>
      parseSessionDescription({ type: "pranswer", sdp: "v=0\r\n" })
    ).toThrow("sessionDescription.type must be 'offer' or 'answer'");
  });

  it("throws for missing type", () => {
    expect(() => parseSessionDescription({ sdp: "v=0\r\n" })).toThrow(
      "sessionDescription.type must be 'offer' or 'answer'"
    );
  });

  it("throws for non-string sdp", () => {
    expect(() =>
      parseSessionDescription({ type: "offer", sdp: 123 })
    ).toThrow("sessionDescription.sdp must be a string");
  });

  it("throws for missing sdp", () => {
    expect(() => parseSessionDescription({ type: "offer" })).toThrow(
      "sessionDescription.sdp must be a string"
    );
  });
});

// ---------- parseTrackInfo ----------

describe("parseTrackInfo", () => {
  it("parses a valid local track with mid", () => {
    const result = parseTrackInfo({
      location: "local",
      trackName: "cast-video",
      mid: "0",
    });
    expect(result).toEqual({
      location: "local",
      trackName: "cast-video",
      mid: "0",
    });
  });

  it("parses a valid remote track without mid", () => {
    const result = parseTrackInfo({
      location: "remote",
      trackName: "cast-audio",
    });
    expect(result).toEqual({
      location: "remote",
      trackName: "cast-audio",
    });
  });

  it("throws for non-object input", () => {
    expect(() => parseTrackInfo(42)).toThrow("track must be an object");
  });

  it("throws for invalid location", () => {
    expect(() =>
      parseTrackInfo({ location: "somewhere", trackName: "test" })
    ).toThrow("track.location must be 'local' or 'remote'");
  });

  it("throws for missing trackName", () => {
    expect(() => parseTrackInfo({ location: "local" })).toThrow(
      "trackName must be a non-empty string"
    );
  });

  it("throws for empty trackName", () => {
    expect(() =>
      parseTrackInfo({ location: "local", trackName: "" })
    ).toThrow("trackName must be a non-empty string");
  });

  it("throws for non-string mid", () => {
    expect(() =>
      parseTrackInfo({ location: "local", trackName: "v", mid: 123 })
    ).toThrow("track.mid must be a string when provided");
  });
});

// ---------- parsePublisherPrepareRequest ----------

describe("parsePublisherPrepareRequest", () => {
  it("parses a valid request with ice servers", () => {
    const result = parsePublisherPrepareRequest({
      url: "https://example.com/game",
      iceServers: [{ urls: "stun:stun.example.com:3478" }],
    });
    expect(result).toEqual({
      url: "https://example.com/game",
      iceServers: [{ urls: "stun:stun.example.com:3478" }],
    });
  });

  it("parses a valid request without ice servers", () => {
    const result = parsePublisherPrepareRequest({
      url: "https://example.com/game",
    });
    expect(result).toEqual({
      url: "https://example.com/game",
      iceServers: [],
    });
  });

  it("throws for non-object input", () => {
    expect(() => parsePublisherPrepareRequest("bad")).toThrow(
      "request body must be an object"
    );
  });

  it("throws for missing url", () => {
    expect(() => parsePublisherPrepareRequest({ iceServers: [] })).toThrow(
      "url must be a non-empty string"
    );
  });

  it("throws for empty url", () => {
    expect(() =>
      parsePublisherPrepareRequest({ url: "", iceServers: [] })
    ).toThrow("url must be a non-empty string");
  });
});

// ---------- parsePublisherPrepareResponse ----------

describe("parsePublisherPrepareResponse", () => {
  it("parses a valid response", () => {
    const result = parsePublisherPrepareResponse({
      sessionDescription: { type: "offer", sdp: "v=0\r\n" },
      tracks: [{ location: "local", trackName: "cast-video", mid: "0" }],
      traceId: "abc-123",
    });
    expect(result).toEqual({
      sessionDescription: { type: "offer", sdp: "v=0\r\n" },
      tracks: [{ location: "local", trackName: "cast-video", mid: "0" }],
      traceId: "abc-123",
    });
  });

  it("throws for non-object input", () => {
    expect(() => parsePublisherPrepareResponse(null)).toThrow(
      "response body must be an object"
    );
  });

  it("throws for missing sessionDescription", () => {
    expect(() =>
      parsePublisherPrepareResponse({ tracks: [], traceId: "x" })
    ).toThrow("sessionDescription must be an object");
  });

  it("throws for non-array tracks", () => {
    expect(() =>
      parsePublisherPrepareResponse({
        sessionDescription: { type: "offer", sdp: "v=0\r\n" },
        tracks: "not-array",
        traceId: "x",
      })
    ).toThrow("tracks must be an array");
  });

  it("throws for missing traceId", () => {
    expect(() =>
      parsePublisherPrepareResponse({
        sessionDescription: { type: "offer", sdp: "v=0\r\n" },
        tracks: [],
      })
    ).toThrow("traceId must be a non-empty string");
  });
});

// ---------- parsePublisherAnswerRequest ----------

describe("parsePublisherAnswerRequest", () => {
  it("parses a valid answer request", () => {
    const result = parsePublisherAnswerRequest({
      sessionDescription: { type: "answer", sdp: "v=0\r\n" },
    });
    expect(result).toEqual({
      sessionDescription: { type: "answer", sdp: "v=0\r\n" },
    });
  });

  it("throws for non-object input", () => {
    expect(() => parsePublisherAnswerRequest(123)).toThrow(
      "request body must be an object"
    );
  });

  it("throws for missing sessionDescription", () => {
    expect(() => parsePublisherAnswerRequest({})).toThrow(
      "sessionDescription must be an object"
    );
  });
});

// ---------- parseSubscribeRequest ----------

describe("parseSubscribeRequest", () => {
  it("parses a valid subscribe request", () => {
    const result = parseSubscribeRequest({
      publisherSessionId: "session-abc-123",
    });
    expect(result).toEqual({ publisherSessionId: "session-abc-123" });
  });

  it("throws for non-object input", () => {
    expect(() => parseSubscribeRequest(null)).toThrow(
      "request body must be an object"
    );
  });

  it("throws for missing publisherSessionId", () => {
    expect(() => parseSubscribeRequest({})).toThrow(
      "publisherSessionId must be a non-empty string"
    );
  });

  it("throws for empty publisherSessionId", () => {
    expect(() =>
      parseSubscribeRequest({ publisherSessionId: "" })
    ).toThrow("publisherSessionId must be a non-empty string");
  });
});

// ---------- parseSubscribeResponse ----------

describe("parseSubscribeResponse", () => {
  it("parses a valid subscribe response", () => {
    const result = parseSubscribeResponse({
      sessionDescription: { type: "offer", sdp: "v=0\r\n" },
      sessionId: "sub-session-123",
    });
    expect(result).toEqual({
      sessionDescription: { type: "offer", sdp: "v=0\r\n" },
      sessionId: "sub-session-123",
    });
  });

  it("throws for non-object input", () => {
    expect(() => parseSubscribeResponse("bad")).toThrow(
      "response body must be an object"
    );
  });

  it("throws for missing sessionDescription", () => {
    expect(() => parseSubscribeResponse({ sessionId: "x" })).toThrow(
      "sessionDescription must be an object"
    );
  });

  it("throws for missing sessionId", () => {
    expect(() =>
      parseSubscribeResponse({
        sessionDescription: { type: "offer", sdp: "v=0\r\n" },
      })
    ).toThrow("sessionId must be a non-empty string");
  });

  it("throws for empty sessionId", () => {
    expect(() =>
      parseSubscribeResponse({
        sessionDescription: { type: "offer", sdp: "v=0\r\n" },
        sessionId: "",
      })
    ).toThrow("sessionId must be a non-empty string");
  });
});

// ---------- parseSubscribeAnswerRequest ----------

describe("parseSubscribeAnswerRequest", () => {
  it("parses a valid subscribe answer request", () => {
    const result = parseSubscribeAnswerRequest({
      sessionDescription: { type: "answer", sdp: "v=0\r\n" },
      subscriberSessionId: "sub-123",
    });
    expect(result).toEqual({
      sessionDescription: { type: "answer", sdp: "v=0\r\n" },
      subscriberSessionId: "sub-123",
    });
  });

  it("throws for non-object input", () => {
    expect(() => parseSubscribeAnswerRequest(null)).toThrow(
      "request body must be an object"
    );
  });

  it("throws for missing sessionDescription", () => {
    expect(() =>
      parseSubscribeAnswerRequest({ subscriberSessionId: "x" })
    ).toThrow("sessionDescription must be an object");
  });

  it("throws for missing subscriberSessionId", () => {
    expect(() =>
      parseSubscribeAnswerRequest({
        sessionDescription: { type: "answer", sdp: "v=0\r\n" },
      })
    ).toThrow("subscriberSessionId must be a non-empty string");
  });

  it("throws for empty subscriberSessionId", () => {
    expect(() =>
      parseSubscribeAnswerRequest({
        sessionDescription: { type: "answer", sdp: "v=0\r\n" },
        subscriberSessionId: "  ",
      })
    ).toThrow("subscriberSessionId must be a non-empty string");
  });
});
