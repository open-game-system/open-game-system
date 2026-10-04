import { initialSession } from "@open-game-system/ogs-protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { backoffMs, createWsClient, type SocketLike } from "./ws-client";

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  sent: string[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
  receive(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

function setup() {
  const timers: { fn: () => void; ms: number }[] = [];
  const client = createWsClient({
    url: "ws://x/api/v1/couch/ws?token=t",
    socket: (url) => new FakeSocket(url),
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
    },
  });
  return { client, timers, sock: () => FakeSocket.all[FakeSocket.all.length - 1]! };
}

describe("couch session socket", () => {
  beforeEach(() => {
    FakeSocket.all = [];
  });

  it("connects to the url and starts in connecting", () => {
    const { client, sock } = setup();
    expect(sock().url).toBe("ws://x/api/v1/couch/ws?token=t");
    expect(client.getSnapshot()).toEqual({ state: null, connection: "connecting" });
  });

  it("publishes parsed state and notifies subscribers", () => {
    const { client, sock } = setup();
    let calls = 0;
    client.subscribe(() => calls++);
    sock().open();
    const state = initialSession("s1", "jonathan");
    sock().receive({ type: "state", state });
    expect(client.getSnapshot()).toEqual({ state, connection: "open" });
    expect(calls).toBe(2);
  });

  it("keeps the snapshot identity stable between changes (useSyncExternalStore)", () => {
    const { client } = setup();
    expect(client.getSnapshot()).toBe(client.getSnapshot());
  });

  it("ignores malformed messages", () => {
    const { client, sock } = setup();
    sock().open();
    sock().receive({ type: "state", state: { nope: 1 } });
    expect(client.getSnapshot().state).toBeNull();
  });

  it("forwards focus.move to listeners", () => {
    const { client, sock } = setup();
    const dirs: string[] = [];
    client.onFocusMove((d) => dirs.push(d));
    sock().open();
    sock().receive({ type: "focus.move", dir: "right" });
    expect(dirs).toEqual(["right"]);
  });

  it("sends client messages as JSON while open, drops them while closed", () => {
    const { client, sock } = setup();
    client.send({ type: "focus.set", itemId: "game:a" });
    sock().open();
    client.send({ type: "focus.set", itemId: "game:b" });
    expect(sock().sent).toEqual(['{"type":"focus.set","itemId":"game:b"}']);
  });

  it("keeps the last state while reconnecting with backoff", () => {
    const { client, sock, timers } = setup();
    sock().open();
    const state = initialSession("s1", "jonathan");
    sock().receive({ type: "state", state });
    sock().drop();
    expect(client.getSnapshot()).toEqual({ state, connection: "reconnecting" });
    expect(timers.map((t) => t.ms)).toEqual([backoffMs(0)]);
    timers[0]!.fn();
    expect(FakeSocket.all).toHaveLength(2);
    sock().drop();
    expect(timers.map((t) => t.ms)).toEqual([backoffMs(0), backoffMs(1)]);
    timers[1]!.fn();
    sock().open();
    expect(client.getSnapshot().connection).toBe("open");
    sock().drop();
    expect(timers[2]!.ms).toBe(backoffMs(0));
  });

  it("stays connecting when it never had state", () => {
    const { client, sock } = setup();
    sock().drop();
    expect(client.getSnapshot().connection).toBe("connecting");
  });

  it("stops reconnecting after close", () => {
    const { client, sock, timers } = setup();
    sock().open();
    client.close();
    sock().drop();
    expect(timers).toHaveLength(0);
  });

  it("backs off exponentially up to a cap", () => {
    expect(backoffMs(0)).toBe(500);
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(3)).toBe(4000);
    expect(backoffMs(20)).toBe(10000);
  });

  it("only reads text frames", () => {
    const { client, sock } = setup();
    const dirs: string[] = [];
    client.onFocusMove((d) => dirs.push(d));
    sock().open();
    // A non-string frame whose string form happens to be a valid message is still ignored.
    const frame = { toString: () => JSON.stringify({ type: "focus.move", dir: "up" }) };
    sock().onmessage?.({ data: frame });
    expect(dirs).toEqual([]);
  });
});

/** Stands in for the browser's WebSocket when the client is built without a `socket` option. */
class BrowserWs {
  static all: BrowserWs[] = [];
  readyState = 0;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(public url: string) {
    BrowserWs.all.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.closed = true;
  }
}

describe("couch session socket on the browser WebSocket", () => {
  beforeEach(() => {
    BrowserWs.all = [];
    vi.stubGlobal("WebSocket", BrowserWs);
    return () => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    };
  });
  const last = () => BrowserWs.all[BrowserWs.all.length - 1]!;

  it("opens, receives, sends and closes through the real socket", () => {
    const client = createWsClient({ url: "ws://y/ws", setTimer: () => {} });
    const ws = last();
    expect(ws.url).toBe("ws://y/ws");
    client.send({ type: "focus.set", itemId: "game:a" });
    expect(ws.sent).toEqual([]);
    ws.readyState = 1;
    ws.onopen?.();
    expect(client.getSnapshot().connection).toBe("open");
    const state = initialSession("s1", "jonathan");
    ws.onmessage?.({ data: JSON.stringify({ type: "state", state }) });
    expect(client.getSnapshot().state).toEqual(state);
    client.send({ type: "focus.set", itemId: "game:b" });
    expect(ws.sent).toEqual(['{"type":"focus.set","itemId":"game:b"}']);
    expect(() => ws.onerror?.()).not.toThrow();
    client.close();
    expect(ws.closed).toBe(true);
  });

  it("reconnects on its own timer after a drop", () => {
    vi.useFakeTimers();
    const client = createWsClient({ url: "ws://y/ws" });
    last().onclose?.();
    expect(client.getSnapshot().connection).toBe("connecting");
    vi.advanceTimersByTime(backoffMs(0) - 1);
    expect(BrowserWs.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(BrowserWs.all).toHaveLength(2);
  });
});
