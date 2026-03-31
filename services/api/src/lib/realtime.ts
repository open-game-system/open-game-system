/**
 * Typed client for the Cloudflare Realtime SFU HTTPS API.
 * https://rtc.live.cloudflare.com/v1/apps/{appId}/sessions/...
 *
 * All Realtime API calls happen server-side — APP_SECRET never leaves the Worker.
 */

// ---------- Types ----------

export type SessionDescription = {
  type: "offer" | "answer";
  sdp: string;
};

export type RealtimeTrackInfo = {
  location: "local" | "remote";
  trackName: string;
  mid?: string;
  sessionId?: string;
};

export type RealtimeSessionResponse = {
  sessionId: string;
  sessionDescription: SessionDescription;
};

export type CloseTracksResponse = {
  tracks: Array<{ trackName: string; status: string }>;
};

export type RealtimeCredentials = {
  appId: string;
  appSecret: string;
};

export type AddTracksRequest = {
  sessionDescription: SessionDescription;
  tracks: RealtimeTrackInfo[];
};

// ---------- Response parsing ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSessionDescription(value: unknown): SessionDescription {
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

export function parseSessionResponse(value: unknown): RealtimeSessionResponse {
  if (!isRecord(value)) {
    throw new Error("Realtime session response must be an object");
  }

  if (typeof value.sessionId !== "string" || value.sessionId.length === 0) {
    throw new Error("sessionId must be a non-empty string");
  }

  return {
    sessionId: value.sessionId,
    sessionDescription: parseSessionDescription(value.sessionDescription),
  };
}

function parseCloseTracksResponse(value: unknown): CloseTracksResponse {
  if (!isRecord(value)) {
    throw new Error("closeTracks response must be an object");
  }

  if (!Array.isArray(value.tracks)) {
    throw new Error("closeTracks response.tracks must be an array");
  }

  const tracks = value.tracks.map((track: unknown) => {
    if (!isRecord(track)) {
      throw new Error("track entry must be an object");
    }
    if (typeof track.trackName !== "string") {
      throw new Error("track.trackName must be a string");
    }
    if (typeof track.status !== "string") {
      throw new Error("track.status must be a string");
    }
    return { trackName: track.trackName, status: track.status };
  });

  return { tracks };
}

// ---------- Internal helpers ----------

function baseUrl(appId: string): string {
  return `https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions`;
}

function authHeaders(appSecret: string): Record<string, string> {
  return {
    Authorization: `Bearer ${appSecret}`,
    "Content-Type": "application/json",
  };
}

// ---------- Public API ----------

/**
 * Create a new Realtime SFU session with an SDP offer.
 */
export async function createSession(
  creds: RealtimeCredentials,
  offer: SessionDescription
): Promise<RealtimeSessionResponse> {
  const url = `${baseUrl(creds.appId)}/new`;
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(creds.appSecret),
    body: JSON.stringify({ sessionDescription: offer }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Realtime API createSession failed: ${response.status} — ${body}`);
  }

  const json = await response.json();
  if (isRecord(json) && json.errorCode) {
    throw new Error(`Realtime API createSession failed: ${response.status} — ${json.errorCode}: ${json.errorDescription}`);
  }

  try {
    return parseSessionResponse(json);
  } catch (parseErr) {
    throw new Error(`Realtime createSession parse failed (${response.status}): ${(parseErr as Error).message} — raw: ${JSON.stringify(json).substring(0, 300)}`);
  }
}

/**
 * Add tracks to an existing session (publisher push).
 */
export async function addTracks(
  creds: RealtimeCredentials,
  sessionId: string,
  request: AddTracksRequest
): Promise<RealtimeSessionResponse> {
  const url = `${baseUrl(creds.appId)}/${sessionId}/tracks/new`;
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(creds.appSecret),
    body: JSON.stringify({
      sessionDescription: request.sessionDescription,
      tracks: request.tracks,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Realtime API addTracks failed: ${response.status} — ${body}`);
  }

  const json = await response.json();
  if (isRecord(json) && json.errorCode) {
    throw new Error(`Realtime API addTracks failed: ${response.status} — ${json.errorCode}: ${json.errorDescription}`);
  }

  // addTracks returns { sessionDescription, tracks, requiresImmediateRenegotiation } — no sessionId
  if (!isRecord(json) || !json.sessionDescription) {
    throw new Error(`Realtime addTracks: unexpected response — raw: ${JSON.stringify(json).substring(0, 300)}`);
  }
  return {
    sessionId: sessionId,
    sessionDescription: parseSessionDescription(json.sessionDescription),
  };
}

/**
 * Renegotiate a session with an SDP answer.
 */
export async function renegotiate(
  creds: RealtimeCredentials,
  sessionId: string,
  answer: SessionDescription
): Promise<RealtimeSessionResponse> {
  const url = `${baseUrl(creds.appId)}/${sessionId}/renegotiate`;
  const response = await fetch(url, {
    method: "PUT",
    headers: authHeaders(creds.appSecret),
    body: JSON.stringify({ sessionDescription: answer }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Realtime API renegotiate failed: ${response.status} — ${body}`);
  }

  const json = await response.json();
  if (isRecord(json) && json.errorCode) {
    throw new Error(`Realtime API renegotiate failed: ${response.status} — ${json.errorCode}: ${json.errorDescription}`);
  }

  // renegotiate may not return sessionId
  if (isRecord(json) && json.sessionDescription) {
    return {
      sessionId: sessionId,
      sessionDescription: parseSessionDescription(json.sessionDescription),
    };
  }
  return parseSessionResponse(json);
}

/**
 * Close tracks by name on a session.
 */
export async function closeTracks(
  creds: RealtimeCredentials,
  sessionId: string,
  trackNames: string[]
): Promise<CloseTracksResponse> {
  const url = `${baseUrl(creds.appId)}/${sessionId}/tracks/close`;
  const response = await fetch(url, {
    method: "PUT",
    headers: authHeaders(creds.appSecret),
    body: JSON.stringify({
      tracks: trackNames.map((trackName) => ({ trackName })),
      force: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Realtime API closeTracks failed: ${response.status} — ${body}`);
  }

  return parseCloseTracksResponse(await response.json());
}
