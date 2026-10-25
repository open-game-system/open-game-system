import type { ClientMessage } from "@open-game-system/ogs-protocol";

/**
 * The slice of WebSocket the link needs (React Native's global WebSocket has it). Handlers take
 * `never`: the link only sets them, so any WebSocket's event types fit.
 */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: never) => unknown) | null;
  onclose: ((ev: never) => unknown) | null;
}

const OPEN = 1;
const BASE_DELAY = 1000;
const MAX_DELAY = 8000;

/** The couch session's WebSocket for a device token (the token is a query parameter: no headers on WebSockets). */
export function couchSocketUrl(apiBase: string, deviceToken: string, sessionId: string): string {
  const ws = apiBase.replace(/^http/, "ws");
  return `${ws}/api/v1/couch/ws?token=${encodeURIComponent(deviceToken)}&session=${encodeURIComponent(sessionId)}`;
}

/**
 * A game's own app's line to the couch session it cast: it only says what the game wants on the
 * TV (`say()` returns those messages, sent on every open and on `announce()`), reconnecting with
 * backoff until closed. Nothing it receives matters to it (the shell has no remote).
 */
export function createCouchLink(opts: {
  url: string;
  createSocket: (url: string) => SocketLike;
  say: () => ClientMessage[];
}) {
  let socket: SocketLike | null = null;
  let closed = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const sendAll = () => {
    if (socket?.readyState !== OPEN) return;
    for (const msg of opts.say()) socket.send(JSON.stringify(msg));
  };

  function connect() {
    const s = opts.createSocket(opts.url);
    socket = s;
    s.onopen = () => {
      attempt = 0;
      sendAll();
    };
    s.onclose = () => {
      if (socket !== s) return;
      socket = null;
      if (closed) return;
      const delay = Math.min(MAX_DELAY, BASE_DELAY * 2 ** attempt);
      attempt++;
      timer = setTimeout(connect, delay);
    };
  }

  connect();
  return {
    /** What `say()` returns changed: send it now if the socket is open (else on open). */
    announce: sendAll,
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
      socket = null;
    },
  };
}
