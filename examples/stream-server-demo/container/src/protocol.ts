export type IceServerConfig = {
  urls: string[] | string;
  username?: string;
  credential?: string;
};

export type StartStreamRequest = {
  url: string;
  peerId: string;
  iceServers: IceServerConfig[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

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
