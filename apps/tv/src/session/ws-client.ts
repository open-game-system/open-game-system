import type { ClientMessage } from "@open-game-system/ogs-protocol";
import type { Dir } from "../launcher/focus-grid";
import { Emitter, type SessionClient, type SessionSnapshot } from "./client";
import { parseServerMessage } from "./messages";

/** The slice of WebSocket the client uses, so tests can drive it. */
export interface SocketLike {
  readyState: number;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export const backoffMs = (attempt: number) => Math.min(10_000, 500 * 2 ** attempt);

const OPEN = 1;

function browserSocket(url: string): SocketLike {
  const ws = new WebSocket(url);
  const s: SocketLike = {
    get readyState() {
      return ws.readyState;
    },
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
    send: (d) => ws.send(d),
    close: () => ws.close(),
  };
  // Stryker disable next-line OptionalChaining: equivalent, createWsClient always sets onopen
  ws.onopen = () => s.onopen?.();
  // Stryker disable next-line OptionalChaining: equivalent, createWsClient always sets onclose
  ws.onclose = () => s.onclose?.();
  // Stryker disable next-line ArrowFunction: equivalent, createWsClient never sets onerror (a close follows an error)
  ws.onerror = () => s.onerror?.();
  // Stryker disable next-line OptionalChaining: equivalent, createWsClient always sets onmessage
  ws.onmessage = (e) => s.onmessage?.({ data: e.data });
  return s;
}

/**
 * The launcher's couch session socket. The server identifies the launcher from its token, so no
 * hello is sent (a hello from a launcher counts a cast; a reconnect is not a recast).
 */
export function createWsClient(opts: {
  url: string;
  socket?: (url: string) => SocketLike;
  setTimer?: (fn: () => void, ms: number) => void;
}): SessionClient {
  const makeSocket = opts.socket ?? browserSocket;
  const setTimer = opts.setTimer ?? ((fn, ms) => void setTimeout(fn, ms));
  const changes = new Emitter<void>();
  const moves = new Emitter<Dir>();
  let snapshot: SessionSnapshot = { state: null, connection: "connecting" };
  let attempt = 0;
  let closed = false;
  let ws: SocketLike;

  const publish = (next: Partial<SessionSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    changes.emit();
  };

  const connect = () => {
    ws = makeSocket(opts.url);
    ws.onopen = () => {
      attempt = 0;
      publish({ connection: "open" });
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      const msg = parseServerMessage(e.data);
      if (msg?.type === "state") publish({ state: msg.state });
      else if (msg?.type === "focus.move") moves.emit(msg.dir);
    };
    ws.onclose = () => {
      if (closed) return;
      publish({ connection: snapshot.state ? "reconnecting" : "connecting" });
      setTimer(connect, backoffMs(attempt++));
    };
  };
  connect();

  return {
    subscribe: (fn) => changes.on(fn),
    getSnapshot: () => snapshot,
    send: (msg: ClientMessage) => {
      if (ws.readyState === OPEN) ws.send(JSON.stringify(msg));
    },
    onFocusMove: (fn) => moves.on(fn),
    close: () => {
      closed = true;
      ws.close();
    },
  };
}
