import type { ClientMessage, SessionState } from "@open-game-system/ogs-protocol";
import { z } from "zod";

/**
 * The phone's live link to the household's couch session (services/api CouchSession, one per
 * household): a WebSocket that says hello, mirrors the session's state, follows the host role
 * (a game started from the TV with the remote opens here) and offers the remote when its holder
 * goes dark. Reconnects with backoff. Everything incoming is parsed before it is believed.
 */

const RosterEntry = z.object({
  personId: z.string(),
  roleId: z.string(),
  deviceId: z.string().optional(),
});

// Mirrors SessionState in @open-game-system/ogs-protocol (which exports the type, not a schema).
const SessionStateSchema = z.object({
  householdId: z.string(),
  cast: z.boolean(),
  screen: z.enum(["home", "game-page", "game"]),
  focus: z.string().nullable(),
  page: z.string().nullable(),
  current: z
    .object({
      appId: z.string(),
      instanceId: z.string(),
      mode: z.enum(["continue", "new"]),
      roster: z.array(RosterEntry),
      label: z.string(),
      startedAt: z.number(),
      viewUrl: z.string().nullable(),
      hostDeviceId: z.string().nullable(),
    })
    .nullable(),
  suspended: z.array(
    z.object({ appId: z.string(), instanceId: z.string(), label: z.string(), at: z.number() }),
  ),
  remote: z.string().nullable(),
  devices: z.array(
    z.object({
      deviceId: z.string(),
      kind: z.enum(["phone", "tablet", "launcher"]),
      personId: z.string().optional(),
      online: z.boolean(),
    }),
  ),
  rosters: z.record(z.string(), z.array(RosterEntry)),
  casts: z.number(),
});

// Compile-time guard: the schema must keep producing the protocol's SessionState.
type ParsedState = z.infer<typeof SessionStateSchema>;
const _stateMatchesProtocol: ParsedState extends SessionState ? true : never = true;
void _stateMatchesProtocol;

const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state"), state: SessionStateSchema }),
  z.object({
    type: z.literal("follow"),
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("launcher") }),
      z.object({
        kind: z.literal("game"),
        appId: z.string(),
        instanceId: z.string(),
        roleId: z.string(),
      }),
    ]),
  }),
  z.object({ type: z.literal("remote.offer"), from: z.string() }),
  z.object({ type: z.literal("error"), code: z.string().default("ERROR"), message: z.string() }),
]);

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
  personId?: string;
  createSocket: (url: string) => SocketLike;
  /** The session made this phone the host of a game (e.g. OK pressed on the TV): open it. */
  onFollowHost?: (game: { appId: string; instanceId: string }) => void;
}

const OPEN = 1;
const BASE_DELAY = 500;
const MAX_DELAY = 8000;
const MAX_QUEUE = 20;

export function couchSocketUrl(apiBase: string, deviceToken: string): string {
  const ws = apiBase.replace(/^http/, "ws");
  return `${ws}/api/v1/couch/ws?token=${encodeURIComponent(deviceToken)}`;
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

  const raw = (msg: ClientMessage) => socket?.send(JSON.stringify(msg));

  function handle(data: unknown) {
    let json: unknown;
    try {
      json = JSON.parse(String(data));
    } catch {
      return;
    }
    const parsed = ServerMessageSchema.safeParse(json);
    if (!parsed.success) return;
    const msg = parsed.data;
    switch (msg.type) {
      case "state":
        set({ state: msg.state });
        break;
      case "follow":
        if (msg.target.kind === "game" && msg.target.roleId === "host")
          opts.onFollowHost?.({ appId: msg.target.appId, instanceId: msg.target.instanceId });
        break;
      case "remote.offer":
        set({ remoteOffer: { from: msg.from } });
        break;
      case "error":
        set({ error: { code: msg.code, message: msg.message } });
        break;
    }
  }

  function connect() {
    timer = null;
    const ws = opts.createSocket(opts.url);
    socket = ws;
    ws.onopen = () => {
      if (socket !== ws) return;
      attempt = 0;
      set({ status: "open", error: null });
      raw({ type: "hello", deviceId: opts.deviceId, kind: "phone", personId: opts.personId });
      for (const msg of queue.splice(0)) raw(msg);
    };
    ws.onmessage = (ev) => {
      if (socket === ws) handle(ev.data);
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
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
