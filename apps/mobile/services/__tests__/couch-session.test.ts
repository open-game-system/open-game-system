import { initialSession, type SessionState } from "@open-game-system/ogs-protocol";
import { couchSocketUrl, createCouchSession, type SocketLike } from "../couch-session";

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  sent: unknown[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: typeof msg === "string" ? msg : JSON.stringify(msg) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const last = () => {
  const s = FakeSocket.all[FakeSocket.all.length - 1];
  if (!s) throw new Error("no socket");
  return s;
};

function setup() {
  FakeSocket.all = [];
  const onFollowHost = jest.fn();
  const session = createCouchSession({
    url: "ws://api.test/api/v1/couch/ws?token=t",
    deviceId: "phone-1",
    createSocket: (url) => new FakeSocket(url),
    onFollowHost,
  });
  session.start();
  return { session, onFollowHost };
}

const state = (patch: Partial<SessionState> = {}): SessionState => ({
  ...initialSession("h1"),
  ...patch,
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("couch session socket URL", () => {
  it("turns the API base into the household's couch socket with the device token", () => {
    expect(couchSocketUrl("http://localhost:8787", "a b")).toBe(
      "ws://localhost:8787/api/v1/couch/ws?token=a%20b",
    );
    expect(couchSocketUrl("https://api.opengame.org", "t")).toBe(
      "wss://api.opengame.org/api/v1/couch/ws?token=t",
    );
  });
});

describe("couch session client", () => {
  it("says hello as this phone once the socket opens", () => {
    setup();
    last().open();
    expect(last().sent).toEqual([{ type: "hello", deviceId: "phone-1", kind: "phone" }]);
  });

  it("exposes the session's state from parsed state messages", () => {
    const { session } = setup();
    const listener = jest.fn();
    session.subscribe(listener);
    last().open();
    last().receive({ type: "state", state: state({ cast: true, casts: 1 }) });
    expect(session.getSnapshot().state).toMatchObject({ cast: true, casts: 1 });
    expect(session.getSnapshot().status).toBe("open");
    expect(listener).toHaveBeenCalled();
  });

  it("ignores messages that don't parse (no crash, state unchanged)", () => {
    const { session } = setup();
    last().open();
    last().receive("not json");
    last().receive({ type: "state", state: { cast: "yes" } });
    last().receive({ type: "mystery" });
    expect(session.getSnapshot().state).toBeNull();
  });

  it("follows a game this phone hosts (started from the TV with the remote)", () => {
    const { onFollowHost } = setup();
    last().open();
    last().receive({
      type: "follow",
      target: { kind: "game", appId: "rocket-crew", instanceId: "rc-1", roleId: "host" },
    });
    expect(onFollowHost).toHaveBeenCalledWith({ appId: "rocket-crew", instanceId: "rc-1" });
  });

  it("does not open a game for a non-host follow or a launcher follow", () => {
    const { onFollowHost } = setup();
    last().open();
    last().receive({
      type: "follow",
      target: { kind: "game", appId: "rocket-crew", instanceId: "rc-1", roleId: "fixer" },
    });
    last().receive({ type: "follow", target: { kind: "launcher" } });
    expect(onFollowHost).not.toHaveBeenCalled();
  });

  it("offers the remote calmly, and taking it sends remote.take", () => {
    const { session } = setup();
    last().open();
    last().receive({ type: "remote.offer", from: "phone-2" });
    expect(session.getSnapshot().remoteOffer).toEqual({ from: "phone-2" });
    session.takeRemote();
    expect(last().sent).toContainEqual({ type: "remote.take", deviceId: "phone-1" });
    expect(session.getSnapshot().remoteOffer).toBeNull();
  });

  it("dismissing the remote offer sends nothing", () => {
    const { session } = setup();
    last().open();
    last().receive({ type: "remote.offer", from: "phone-2" });
    session.dismissRemoteOffer();
    expect(session.getSnapshot().remoteOffer).toBeNull();
    expect(last().sent).toHaveLength(1);
  });

  it("keeps the last server error for the UI", () => {
    const { session } = setup();
    last().open();
    last().receive({ type: "error", code: "FORBIDDEN", message: "Not your household" });
    expect(session.getSnapshot().error).toEqual({
      code: "FORBIDDEN",
      message: "Not your household",
    });
  });

  it("sends protocol messages while open", () => {
    const { session } = setup();
    last().open();
    session.send({ type: "focus.move", dir: "right" });
    expect(last().sent).toContainEqual({ type: "focus.move", dir: "right" });
  });

  it("holds messages sent before the socket opens and delivers them after hello", () => {
    const { session } = setup();
    session.send({ type: "game.start", appId: "rocket-crew", mode: "continue" });
    last().open();
    expect(last().sent).toEqual([
      { type: "hello", deviceId: "phone-1", kind: "phone" },
      { type: "game.start", appId: "rocket-crew", mode: "continue" },
    ]);
  });

  it("reconnects with growing backoff after a drop, and resets it once connected", () => {
    const { session } = setup();
    last().open();
    last().drop();
    expect(session.getSnapshot().status).toBe("reconnecting");
    expect(FakeSocket.all).toHaveLength(1);
    jest.advanceTimersByTime(500);
    expect(FakeSocket.all).toHaveLength(2);
    last().drop();
    jest.advanceTimersByTime(500);
    expect(FakeSocket.all).toHaveLength(2);
    jest.advanceTimersByTime(500);
    expect(FakeSocket.all).toHaveLength(3);
    last().open();
    last().drop();
    jest.advanceTimersByTime(500);
    expect(FakeSocket.all).toHaveLength(4);
  });

  it("caps the backoff", () => {
    setup();
    for (let i = 0; i < 10; i++) {
      last().drop();
      jest.advanceTimersByTime(10_000);
    }
    const before = FakeSocket.all.length;
    last().drop();
    jest.advanceTimersByTime(10_000);
    expect(FakeSocket.all.length).toBe(before + 1);
  });

  it("stops for good: closes the socket and never reconnects", () => {
    const { session } = setup();
    last().open();
    session.stop();
    expect(last().closed).toBe(true);
    jest.advanceTimersByTime(60_000);
    expect(FakeSocket.all).toHaveLength(1);
    expect(session.getSnapshot().status).toBe("closed");
  });
});
