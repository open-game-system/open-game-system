import { DurableObject } from "cloudflare:workers";
import {
  type ClientMessage,
  ClientMessageSchema,
  initialSession,
  type Outbound,
  reduceSession,
  type SessionState,
  SessionStateSchema,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";
import { type Peer as Recipient, recipients } from "./couch/route";
import { recordLive } from "./lib/presence";
import type { Env } from "./types";

/** Header the Worker uses to hand the verified peer to the DO (reachable only through the binding). */
export const PEER_HEADER = "X-OGS-Peer";

/** Who is connecting, from the verified token and D1: the session, the device and its profile. */
const PeerSchema = z.object({
  sessionId: z.string(),
  hostProfileId: z.string(),
  deviceId: z.string(),
  kind: z.enum(["phone", "tablet", "launcher"]),
  profile: z.object({ profileId: z.string(), name: z.string(), sticker: z.string() }).optional(),
});
export type Peer = z.infer<typeof PeerSchema>;

const STATE_KEY = "state";

type ErrorCode = "invalid_json" | "invalid_message" | "identity_from_token";

/**
 * One couch session per cast (`idFromName(sessionId)`): the host's phone, the TV launcher and
 * every phone or tablet that joined, on WebSockets (hibernation API). Identity comes only from the token:
 * the DO says `hello` on connect and `bye` when a device's last socket closes. Every other frame
 * is parsed with ClientMessageSchema and applied with the protocol's pure `reduceSession`.
 */
export class CouchSession extends DurableObject<Env> {
  private state: SessionState | null = null;

  async fetch(request: Request): Promise<Response> {
    const parsed = PeerSchema.safeParse(JSON.parse(request.headers.get(PEER_HEADER) ?? "null"));
    if (!parsed.success || request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("couch session expects a verified WebSocket upgrade", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const peer = parsed.data;
    this.ctx.acceptWebSocket(server, [`device:${peer.deviceId}`]);
    server.serializeAttachment(peer);
    await this.apply(peer, {
      type: "hello",
      deviceId: peer.deviceId,
      kind: peer.kind,
      profile: peer.profile,
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const peer = attachment(ws);
    if (!peer) return;
    let raw: unknown;
    try {
      raw = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data));
    } catch {
      return sendError(ws, "invalid_json", "Frames must be JSON");
    }
    const parsed = ClientMessageSchema.safeParse(raw);
    if (!parsed.success) return sendError(ws, "invalid_message", "Not a couch session message");
    const msg = fromSender(parsed.data, peer);
    if (!msg)
      return sendError(
        ws,
        "identity_from_token",
        "hello and bye come from the token, not the client",
      );
    await this.apply(peer, msg);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
    } catch {
      // Already closed.
    }
    await this.leave(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.leave(ws);
  }

  /** `bye` once the device's last open socket is gone (a device may hold several). */
  private async leave(ws: WebSocket): Promise<void> {
    const peer = attachment(ws);
    if (!peer) return;
    ws.serializeAttachment(null);
    const stillOpen = this.ctx
      .getWebSockets(`device:${peer.deviceId}`)
      .some((other) => other !== ws && other.readyState === WebSocket.OPEN && attachment(other));
    if (!stillOpen) await this.apply(peer, { type: "bye", deviceId: peer.deviceId });
  }

  private async load(peer: Peer): Promise<SessionState> {
    if (this.state) return this.state;
    const stored = SessionStateSchema.safeParse(await this.ctx.storage.get(STATE_KEY));
    this.state = stored.success ? stored.data : initialSession(peer.sessionId, peer.hostProfileId);
    return this.state;
  }

  private async apply(peer: Peer, msg: ClientMessage): Promise<void> {
    const before = await this.load(peer);
    const { state, out } = reduceSession(before, msg, Date.now());
    this.state = state;
    await this.ctx.storage.put(STATE_KEY, state);
    await this.publishLive(before, state);
    this.route(out);
  }

  /** Friends' presence and Join cards read D1: whether the TV is connected and which game runs. */
  private async publishLive(before: SessionState, after: SessionState): Promise<void> {
    const appId = (s: SessionState) => s.current?.appId ?? null;
    if (before.cast === after.cast && appId(before) === appId(after)) return;
    await recordLive(
      this.env.DB,
      after.sessionId,
      after.cast ? { appId: appId(after) } : null,
      Date.now(),
    );
  }

  private route(out: Outbound[]): void {
    const sockets = this.ctx.getWebSockets().flatMap((ws) => {
      const peer = attachment(ws);
      return peer ? [{ ws, peer }] : [];
    });
    const peers: Recipient[] = sockets.map((s) => s.peer);
    for (const o of out) {
      const frame = JSON.stringify(o.msg);
      for (const i of recipients(o, peers)) {
        try {
          sockets[i].ws.send(frame);
        } catch {
          // A socket closing mid-broadcast gets its bye from webSocketClose.
        }
      }
    }
  }
}

function attachment(ws: WebSocket): Peer | null {
  const parsed = PeerSchema.safeParse(ws.deserializeAttachment());
  return parsed.success ? parsed.data : null;
}

/** Messages naming a device act as the sender; hello/bye are the DO's alone. */
function fromSender(msg: ClientMessage, peer: Peer): ClientMessage | null {
  switch (msg.type) {
    case "hello":
    case "bye":
      return null;
    case "select":
    case "remote.take":
      return { ...msg, deviceId: peer.deviceId };
    default:
      return msg;
  }
}

function sendError(ws: WebSocket, code: ErrorCode, message: string): void {
  ws.send(JSON.stringify({ type: "error", code, message }));
}
