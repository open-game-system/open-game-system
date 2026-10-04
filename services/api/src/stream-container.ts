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
  const path = new URL(request.url).pathname;
  const subscriberId = path.match(/^\/sfu\/subscriber-sessions\/([^/]+)$/)?.[1];
  const route = subscriberId === undefined ? path : "/sfu/subscriber-sessions/:id";
  const handler = SFU_ROUTES.get(`${request.method} ${route}`);
  // All other paths — proxy to container
  return handler ? handler(request, state, subscriberId ?? "") : null;
}

type SfuHandler = (request: Request, state: SfuState, id: string) => Promise<Response> | Response;

const OK = () => Response.json({ status: "ok" });

const SFU_ROUTES = new Map<string, SfuHandler>([
  // Full SFU state snapshot
  [
    "GET /sfu/state",
    (_request, state) =>
      Response.json({
        publisherSessionId: state.publisherSessionId,
        publisherTracks: state.publisherTracks,
        subscriberSessions: Object.fromEntries(state.subscriberSessions),
      }),
  ],
  // Store publisher session info
  [
    "PUT /sfu/publisher-session",
    (request, state) =>
      storeFromBody(request, (body) => {
        const parsed = parsePublisherSessionBody(body);
        state.publisherSessionId = parsed.publisherSessionId;
        state.publisherTracks = parsed.tracks;
      }),
  ],
  // Store a subscriber session
  [
    "PUT /sfu/subscriber-sessions/:id",
    (request, state, id) =>
      storeFromBody(request, (body) => {
        state.subscriberSessions.set(id, parseSubscriberSessionBody(body).sessionId);
      }),
  ],
  // Remove a subscriber session (idempotent)
  [
    "DELETE /sfu/subscriber-sessions/:id",
    (_request, state, id) => {
      state.subscriberSessions.delete(id);
      return OK();
    },
  ],
]);

/** Parses the JSON body and stores it; 400 with the reason when it is not JSON or not valid. */
async function storeFromBody(request: Request, store: (body: unknown) => void) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    store(body);
    return OK();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
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
