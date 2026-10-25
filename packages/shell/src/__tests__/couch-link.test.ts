import { couchSocketUrl, createCouchLink, type SocketLike } from "../couch-link";

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const HELLO = [{ type: "home" as const }];

function rig() {
  const sockets: FakeSocket[] = [];
  const link = createCouchLink({
    url: "wss://api.test/api/v1/couch/ws?token=t&session=s",
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    say: () => HELLO,
  });
  return { link, sockets };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("couchSocketUrl", () => {
  it("is the API's couch WebSocket with the token and session encoded", () => {
    expect(couchSocketUrl("https://api.test", "a b", "s/1")).toBe(
      "wss://api.test/api/v1/couch/ws?token=a%20b&session=s%2F1",
    );
    expect(couchSocketUrl("http://localhost:8787", "t", "s")).toBe(
      "ws://localhost:8787/api/v1/couch/ws?token=t&session=s",
    );
  });
});

describe("createCouchLink", () => {
  it("says nothing until the socket is open, then says it on open and on announce", () => {
    const { link, sockets } = rig();
    link.announce();
    expect(sockets[0]?.sent).toEqual([]);
    sockets[0]?.open();
    expect(sockets[0]?.sent).toEqual(HELLO);
    link.announce();
    expect(sockets[0]?.sent).toEqual([...HELLO, ...HELLO]);
  });

  it("reconnects with backoff (1 s, then 2 s), and back to 1 s after a good open", () => {
    const { sockets } = rig();
    sockets[0]?.drop();
    jest.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    sockets[1]?.drop();
    jest.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    jest.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
    sockets[2]?.open();
    sockets[2]?.drop();
    jest.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(4);
  });

  it("caps the backoff at 8 s", () => {
    const { sockets } = rig();
    for (let i = 0; i < 6; i++) {
      sockets[sockets.length - 1]?.drop();
      jest.advanceTimersByTime(8000);
    }
    expect(sockets).toHaveLength(7);
  });

  it("ignores a late close from a socket it already replaced", () => {
    const { sockets } = rig();
    sockets[0]?.drop();
    jest.advanceTimersByTime(1000);
    sockets[0]?.drop();
    jest.advanceTimersByTime(10_000);
    expect(sockets).toHaveLength(2);
  });

  it("close() stops it: the socket closes, a pending reconnect is cancelled, announce is a no-op", () => {
    const { link, sockets } = rig();
    sockets[0]?.open();
    link.close();
    expect(sockets[0]?.closed).toBe(true);
    sockets[0]?.drop();
    jest.advanceTimersByTime(10_000);
    expect(sockets).toHaveLength(1);
    expect(() => link.announce()).not.toThrow();

    const again = rig();
    again.sockets[0]?.drop();
    again.link.close();
    jest.advanceTimersByTime(10_000);
    expect(again.sockets).toHaveLength(1);
  });
});
