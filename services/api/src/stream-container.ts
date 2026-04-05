import { Container } from "@cloudflare/containers";
import type { TrackInfo } from "./protocol";

// ---------- SFU session state ----------

export type SfuState = {
  publisherSessionId: string | null;
  publisherTracks: TrackInfo[];
  subscriberSessions: Map<string, string>;
};

export function createSfuState(): SfuState {
  return {
    publisherSessionId: null,
    publisherTracks: [],
    subscriberSessions: new Map(),
  };
}

// ---------- Internal helpers ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePublisherSessionBody(body: unknown): {
  publisherSessionId: string;
  tracks: TrackInfo[];
} {
  if (!isRecord(body)) {
    throw new Error("body must be an object");
  }
  if (typeof body.publisherSessionId !== "string" || body.publisherSessionId.length === 0) {
    throw new Error("publisherSessionId must be a non-empty string");
  }
  if (!Array.isArray(body.tracks)) {
    throw new Error("tracks must be an array");
  }
  const tracks: TrackInfo[] = body.tracks.map((track: unknown) => {
    if (!isRecord(track)) {
      throw new Error("track must be an object");
    }
    if (track.location !== "local" && track.location !== "remote") {
      throw new Error("track.location must be 'local' or 'remote'");
    }
    if (typeof track.trackName !== "string" || track.trackName.length === 0) {
      throw new Error("trackName must be a non-empty string");
    }
    const result: TrackInfo = { location: track.location, trackName: track.trackName };
    if (typeof track.mid === "string") {
      result.mid = track.mid;
    }
    return result;
  });
  return { publisherSessionId: body.publisherSessionId, tracks };
}

function parseSubscriberSessionBody(body: unknown): { sessionId: string } {
  if (!isRecord(body)) {
    throw new Error("body must be an object");
  }
  if (typeof body.sessionId !== "string" || body.sessionId.length === 0) {
    throw new Error("sessionId must be a non-empty string");
  }
  return { sessionId: body.sessionId };
}

// ---------- SFU request handler ----------

/**
 * Handles internal SFU state management requests.
 * Returns a Response for handled paths, or null for paths that should
 * be proxied to the container (publisher ops, health, etc.).
 */
export async function handleSfuRequest(
  request: Request,
  state: SfuState,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /sfu/state — return full SFU state snapshot
  if (path === "/sfu/state" && request.method === "GET") {
    return Response.json({
      publisherSessionId: state.publisherSessionId,
      publisherTracks: state.publisherTracks,
      subscriberSessions: Object.fromEntries(state.subscriberSessions),
    });
  }

  // PUT /sfu/publisher-session — store publisher session info
  if (path === "/sfu/publisher-session" && request.method === "PUT") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid JSON" }, { status: 400 });
    }
    try {
      const parsed = parsePublisherSessionBody(body);
      state.publisherSessionId = parsed.publisherSessionId;
      state.publisherTracks = parsed.tracks;
      return Response.json({ status: "ok" });
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  // PUT /sfu/subscriber-sessions/:id — store a subscriber session
  const subscriberPutMatch = path.match(/^\/sfu\/subscriber-sessions\/([^/]+)$/);
  if (subscriberPutMatch && request.method === "PUT") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid JSON" }, { status: 400 });
    }
    try {
      const parsed = parseSubscriberSessionBody(body);
      const id = subscriberPutMatch[1];
      state.subscriberSessions.set(id, parsed.sessionId);
      return Response.json({ status: "ok" });
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  // DELETE /sfu/subscriber-sessions/:id — remove a subscriber session
  const subscriberDeleteMatch = path.match(/^\/sfu\/subscriber-sessions\/([^/]+)$/);
  if (subscriberDeleteMatch && request.method === "DELETE") {
    const id = subscriberDeleteMatch[1];
    state.subscriberSessions.delete(id);
    return Response.json({ status: "ok" });
  }

  // All other paths — proxy to container
  return null;
}

// ---------- StreamContainer DO ----------

/**
 * StreamContainer manages a headless Chrome instance that renders
 * a game's spectate URL and streams it via WebRTC through Cloudflare Realtime SFU.
 *
 * Each cast session gets its own container instance.
 * The container runs the stream-kit server on port 8080.
 *
 * The DO stores SFU session state (publisher session ID, tracks, subscriber sessions)
 * for coordination between the worker routes and the container.
 */
export class StreamContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "5m"; // Auto-sleep after 5 minutes of no requests
  enableInternet = true; // Needs internet for Realtime SFU signaling + loading game URLs

  private sfuState: SfuState = createSfuState();

  override async fetch(request: Request): Promise<Response> {
    const handled = await handleSfuRequest(request, this.sfuState);
    if (handled) return handled;
    // Proxy to container for publisher ops, health, etc.
    return super.fetch(request);
  }

  override onStart() {
    console.log("[StreamContainer] Container started");
  }

  override onStop() {
    console.log("[StreamContainer] Container stopped");
  }

  override onError(error: unknown) {
    console.error("[StreamContainer] Container error:", error);
  }
}
