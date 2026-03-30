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

  const rawText = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`Realtime API createSession: invalid JSON response (${response.status}): ${rawText.substring(0, 200)}`);
  }

  if (!response.ok || (isRecord(json) && json.errorCode)) {
    const errorCode = isRecord(json) ? json.errorCode : "unknown";
    const errorDesc = isRecord(json) ? json.errorDescription : JSON.stringify(json);
    throw new Error(`Realtime API createSession failed: ${response.status} — ${errorCode}: ${errorDesc}`);
  }

  try {
    return parseSessionResponse(json);
  } catch (parseErr) {
    throw new Error(`Realtime createSession parse failed (${response.status}): ${(parseErr as Error).message} — raw response: ${rawText.substring(0, 300)}`);
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

  const rawText = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`Realtime API addTracks: invalid JSON (${response.status}): ${rawText.substring(0, 200)}`);
  }

  if (!response.ok || (isRecord(json) && json.errorCode)) {
    const errorCode = isRecord(json) ? json.errorCode : "unknown";
    const errorDesc = isRecord(json) ? json.errorDescription : JSON.stringify(json);
    throw new Error(`Realtime API addTracks failed: ${response.status} — ${errorCode}: ${errorDesc}`);
  }

  try {
    return parseSessionResponse(json);
  } catch (parseErr) {
    throw new Error(`Realtime addTracks parse failed (${response.status}): ${(parseErr as Error).message} — raw: ${rawText.substring(0, 300)}`);
  }
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

  const json = await response.json();

  if (!response.ok || (isRecord(json) && json.errorCode)) {
    const errorCode = isRecord(json) ? json.errorCode : "unknown";
    const errorDesc = isRecord(json) ? json.errorDescription : JSON.stringify(json);
    throw new Error(`Realtime API renegotiate failed: ${response.status} — ${errorCode}: ${errorDesc}`);
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
