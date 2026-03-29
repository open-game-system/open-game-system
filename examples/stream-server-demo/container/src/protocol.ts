export type IceServerConfig = {
  urls: string[] | string;
  username?: string;
  credential?: string;
};

// PeerJS-specific — retained until container server.ts is updated (task 4)
export type StartStreamRequest = {
  url: string;
  peerId: string;
  iceServers: IceServerConfig[];
};

export type SessionDescription = {
  type: "offer" | "answer";
  sdp: string;
};

export type TrackInfo = {
  location: "local" | "remote";
  trackName: string;
  mid?: string;
};

export type PublisherPrepareRequest = {
  url: string;
  iceServers: IceServerConfig[];
};

export type PublisherPrepareResponse = {
  sessionDescription: SessionDescription;
  tracks: TrackInfo[];
  traceId: string;
};

export type PublisherAnswerRequest = {
  sessionDescription: SessionDescription;
};

export type SubscribeRequest = {
  publisherSessionId: string;
};

export type SubscribeResponse = {
  sessionDescription: SessionDescription;
  sessionId: string;
};

export type SubscribeAnswerRequest = {
  sessionDescription: SessionDescription;
  subscriberSessionId: string;
};

// ---------- Internal helpers ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

// ---------- ICE server parsing ----------

export function parseIceServerConfig(value: unknown): IceServerConfig {
  if (!isRecord(value)) {
    throw new Error("ice server must be an object");
  }

  const rawUrls = value.urls;
  const urls = Array.isArray(rawUrls)
    ? rawUrls.map((url, index) => parseNonEmptyString(url, `iceServers[].urls[${index}]`))
    : parseNonEmptyString(rawUrls, "iceServers[].urls");

  if (typeof value.username !== "undefined" && typeof value.username !== "string") {
    throw new Error("iceServers[].username must be a string when provided");
  }

  if (typeof value.credential !== "undefined" && typeof value.credential !== "string") {
    throw new Error("iceServers[].credential must be a string when provided");
  }

  return {
    urls,
    username: value.username,
    credential: value.credential,
  };
}

export function parseIceServers(value: unknown): IceServerConfig[] {
  if (typeof value === "undefined") {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("iceServers must be an array when provided");
  }

  return value.map(parseIceServerConfig);
}

export function parseTurnCredentialsResponse(value: unknown): {
  iceServers: IceServerConfig[];
} {
  if (!isRecord(value) || !("iceServers" in value)) {
    throw new Error("TURN credentials response did not include iceServers");
  }

  return {
    iceServers: parseIceServers(value.iceServers),
  };
}

// PeerJS-specific — retained until container server.ts is updated (task 4)
export function parseStartStreamRequest(value: unknown): StartStreamRequest {
  if (!isRecord(value)) {
    throw new Error("request body must be an object");
  }

  return {
    url: parseNonEmptyString(value.url, "url"),
    peerId: parseNonEmptyString(value.peerId, "peerId"),
    iceServers: parseIceServers(value.iceServers),
  };
}

// ---------- SFU protocol parsing ----------

export function parseSessionDescription(value: unknown): SessionDescription {
  if (!isRecord(value)) {
    throw new Error("sessionDescription must be an object");
  }

  const type = value.type;
  if (type !== "offer" && type !== "answer") {
    throw new Error("sessionDescription.type must be 'offer' or 'answer'");
  }

  if (typeof value.sdp !== "string") {
    throw new Error("sessionDescription.sdp must be a string");
  }

  return { type, sdp: value.sdp };
}

export function parseTrackInfo(value: unknown): TrackInfo {
  if (!isRecord(value)) {
    throw new Error("track must be an object");
  }

  const location = value.location;
  if (location !== "local" && location !== "remote") {
    throw new Error("track.location must be 'local' or 'remote'");
  }

  const trackName = parseNonEmptyString(value.trackName, "trackName");

  if (typeof value.mid !== "undefined" && typeof value.mid !== "string") {
    throw new Error("track.mid must be a string when provided");
  }

  const result: TrackInfo = { location, trackName };
  if (typeof value.mid === "string") {
    result.mid = value.mid;
  }
  return result;
}

function parseTracks(value: unknown): TrackInfo[] {
  if (!Array.isArray(value)) {
    throw new Error("tracks must be an array");
  }

  return value.map(parseTrackInfo);
}

export function parsePublisherPrepareRequest(value: unknown): PublisherPrepareRequest {
  if (!isRecord(value)) {
    throw new Error("request body must be an object");
  }

  return {
    url: parseNonEmptyString(value.url, "url"),
    iceServers: parseIceServers(value.iceServers),
  };
}

export function parsePublisherPrepareResponse(value: unknown): PublisherPrepareResponse {
  if (!isRecord(value)) {
    throw new Error("response body must be an object");
  }

  return {
    sessionDescription: parseSessionDescription(value.sessionDescription),
    tracks: parseTracks(value.tracks),
    traceId: parseNonEmptyString(value.traceId, "traceId"),
  };
}

export function parsePublisherAnswerRequest(value: unknown): PublisherAnswerRequest {
  if (!isRecord(value)) {
    throw new Error("request body must be an object");
  }

  return {
    sessionDescription: parseSessionDescription(value.sessionDescription),
  };
}

export function parseSubscribeRequest(value: unknown): SubscribeRequest {
  if (!isRecord(value)) {
    throw new Error("request body must be an object");
  }

  return {
    publisherSessionId: parseNonEmptyString(value.publisherSessionId, "publisherSessionId"),
  };
}

export function parseSubscribeResponse(value: unknown): SubscribeResponse {
  if (!isRecord(value)) {
    throw new Error("response body must be an object");
  }

  return {
    sessionDescription: parseSessionDescription(value.sessionDescription),
    sessionId: parseNonEmptyString(value.sessionId, "sessionId"),
  };
}

export function parseSubscribeAnswerRequest(value: unknown): SubscribeAnswerRequest {
  if (!isRecord(value)) {
    throw new Error("request body must be an object");
  }

  return {
    sessionDescription: parseSessionDescription(value.sessionDescription),
    subscriberSessionId: parseNonEmptyString(value.subscriberSessionId, "subscriberSessionId"),
  };
}
