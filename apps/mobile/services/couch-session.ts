import {
  type ClientMessage,
  type SessionState,
  SessionStateSchema,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";

/**
 * This device's live link to the couch session it hosts or joined (services/api CouchSession, one
 * per cast): a WebSocket (identity comes from its token; the session says hello for us), mirrors
 * the session's state, follows the host role
 * (a game started from the TV with the remote opens here) and offers the remote when its holder
 * goes dark. Reconnects with backoff. Everything incoming is parsed before it is believed.
 */

const ServerMessageSchema = z.discriminatedUnion("type", [
  // The state is parsed with the protocol's own schema (ogs-protocol is on zod 3, this app on 4).
  z.object({ type: z.literal("state"), state: z.unknown() }),
  z.object({
    type: z.literal("follow"),
    target: z.discriminatedUnion("kind", [
      // Stryker disable next-line StringLiteral: equivalent, an unparsed launcher follow is ignored just like a parsed one
      z.object({ kind: z.literal("launcher") }),
      z.object({
        kind: z.literal("game"),
        appId: z.string(),
        instanceId: z.string(),
        roleId: z.string(),
        room: z.string().optional(),
      }),
    ]),
  }),
  z.object({ type: z.literal("remote.offer"), from: z.string() }),
  z.object({ type: z.literal("error"), code: z.string().default("ERROR"), message: z.string() }),
]);

type ServerMessage = z.infer<typeof ServerMessageSchema>;

/** A server frame, or null for anything that isn't JSON or isn't a server message. */
function readServerFrame(data: unknown): ServerMessage | null {
  try {
    const parsed = ServerMessageSchema.safeParse(JSON.parse(String(data)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** What a server message changes: the snapshot, and/or a game this phone should open as host. */
interface Effect {
  patch?: Partial<CouchSnapshot>;
  followHost?: { appId: string; instanceId: string; room?: string };
}

function effectOf(msg: ServerMessage): Effect {
  switch (msg.type) {
    case "state": {
      const state = SessionStateSchema.safeParse(msg.state);
      return state.success ? { patch: { state: state.data } } : {};
    }
    case "follow":
      return followEffect(msg.target);
    case "remote.offer":
      return { patch: { remoteOffer: { from: msg.from } } };
    case "error":
      return { patch: { error: { code: msg.code, message: msg.message } } };
  }
}

/** Only a host follow into a game opens anything on the phone. */
function followEffect(target: Extract<ServerMessage, { type: "follow" }>["target"]): Effect {
  if (target.kind !== "game" || target.roleId !== "host") return {};
  const { appId, instanceId, room } = target;
  return { followHost: { appId, instanceId, ...(room ? { room } : {}) } };
}

export type CouchStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface CouchSnapshot {
  status: CouchStatus;
  state: SessionState | null;
  remoteOffer: { from: string } | null;
  error: { code: string; message: string } | null;
}

/** The slice of WebSocket this needs (RN's global WebSocket satisfies it). */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export interface CouchSessionOptions {
  url: string;
  deviceId: string;
  createSocket: (url: string) => SocketLike;
  /** The session made this phone the host of a game (e.g. OK pressed on the TV): open it. */
  onFollowHost?: (game: { appId: string; instanceId: string; room?: string }) => void;
}

const OPEN = 1;
const BASE_DELAY = 500;
const MAX_DELAY = 8000;
const MAX_QUEUE = 20;

export function couchSocketUrl(apiBase: string, deviceToken: string, sessionId: string): string {
  const ws = apiBase.replace(/^http/, "ws");
  const token = encodeURIComponent(deviceToken);
  return `${ws}/api/v1/couch/ws?token=${token}&session=${encodeURIComponent(sessionId)}`;
}

export function createCouchSession(opts: CouchSessionOptions) {
  let snapshot: CouchSnapshot = { status: "closed", state: null, remoteOffer: null, error: null };
  const listeners = new Set<() => void>();
  let socket: SocketLike | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = true;
  const queue: ClientMessage[] = [];

  const set = (patch: Partial<CouchSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    for (const l of listeners) l();
  };

  // Stryker disable next-line OptionalChaining: equivalent, raw() only runs while a socket is set
  const raw = (msg: ClientMessage) => socket?.send(JSON.stringify(msg));

  function handle(data: unknown) {
    const msg = readServerFrame(data);
    if (!msg) return;
    const { patch, followHost } = effectOf(msg);
    if (patch) set(patch);
    if (followHost) opts.onFollowHost?.(followHost);
  }

  function connect() {
    timer = null;
    const ws = opts.createSocket(opts.url);
    socket = ws;
    ws.onopen = () => {
      if (socket !== ws) return;
      attempt = 0;
      set({ status: "open", error: null });
      for (const msg of queue.splice(0)) raw(msg);
    };
    ws.onmessage = (ev) => {
      if (socket === ws) handle(ev.data);
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      // Stryker disable next-line ConditionalExpression: equivalent, stop() clears the socket first so a stopped close returns above
      if (stopped) return;
      const delay = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
      attempt++;
      set({ status: "reconnecting" });
      timer = setTimeout(connect, delay);
    };
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      set({ status: "connecting" });
      connect();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      const ws = socket;
      socket = null;
      ws?.close();
      set({ status: "closed" });
    },
    /** Send now if connected, else hold it (bounded) until the socket opens. */
    send(msg: ClientMessage) {
      if (socket && socket.readyState === OPEN) raw(msg);
      else if (queue.length < MAX_QUEUE) queue.push(msg);
    },
    takeRemote() {
      this.send({ type: "remote.take", deviceId: opts.deviceId });
      set({ remoteOffer: null });
    },
    dismissRemoteOffer() {
      set({ remoteOffer: null });
    },
    getSnapshot: (): CouchSnapshot => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type CouchSession = ReturnType<typeof createCouchSession>;
