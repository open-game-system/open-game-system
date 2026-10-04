import { initialSession } from "@open-game-system/ogs-protocol";
import { beforeEach, describe, expect, it } from "vitest";
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
});
