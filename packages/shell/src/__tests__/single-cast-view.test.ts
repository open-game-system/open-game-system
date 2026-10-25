import type { ClientMessage } from "@open-game-system/ogs-protocol";
import { fakeFetch } from "../__fixtures__/fake-fetch";
import { createShellRequest } from "../api-client";
import { castCommands } from "../cast-sync";
import type { SocketLike } from "../couch-link";
import type { ShellIdentity } from "../shell-identity";
import { createSingleGameCastStore } from "../single-cast";

jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

/**
 * A game's own app forwards the TV page its phone page declares (cast-kit useCastViewUrl →
 * SET_VIEW_URL) to the couch session, as the OGS app does (apps/mobile game-cast-route.ts): the
 * chrome=none launcher frames the session's current game, so a room game's TV (/tv/CODE) shows
 * without a catalogue tvUrl.
 */
const identity: ShellIdentity = {
  profile: { id: "p", handle: "player", name: "Player", sticker: "owl" },
  deviceId: "d",
  deviceToken: "device token",
  login: "guest",
};
const sessionCreated = {
  sessionId: "s-1",
  code: "KQTP",
  tvName: "TV",
  host: identity.profile,
  token: "launcher-token",
};
const TV_PAGE = "https://kite.example/tv/ABCD?t=tv-token";

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: ClientMessage[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {}
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

function setup(opts: { withCouch?: boolean } = {}) {
  const sockets: FakeSocket[] = [];
  const net = fakeFetch({ "POST /api/v1/sessions": () => ({ status: 201, body: sessionCreated }) });
  const store = createSingleGameCastStore({
    appId: "kite-count",
    apiBase: "https://api.test",
    tvBase: "https://tv.test",
    request: createShellRequest({ baseUrl: "https://api.test", fetch: net.fetch }),
    getIdentity: () => identity,
    commands: castCommands(() => {}),
    ...(opts.withCouch === false
      ? {}
      : {
          openCouch: (url: string) => {
            const s = new FakeSocket(url);
            sockets.push(s);
            return s;
          },
        }),
  });
  return { store, sockets };
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!check()) throw new Error("timed out");
};

const startAndView = (url: string): ClientMessage[] => [
  { type: "game.start", appId: "kite-count", mode: "new" },
  { type: "game.view", appId: "kite-count", url },
];

beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe("single-game cast: the page's TV view goes to the couch session", () => {
  it("declared before the cast: sent as game.start + game.view once the session's socket opens", async () => {
    const { store, sockets } = setup();
    store.dispatch({ type: "SET_VIEW_URL", url: TV_PAGE });
    store.dispatch({ type: "SHOW_CAST_PICKER" });
    await until(() => sockets.length === 1);
    expect(sockets[0]?.url).toBe("wss://api.test/api/v1/couch/ws?token=device%20token&session=s-1");
    expect(sockets[0]?.sent).toEqual([]);
    sockets[0]?.open();
    expect(sockets[0]?.sent).toEqual(startAndView(TV_PAGE));
  });

  it("declared after the cast: sent at once on the open socket; a new room's page replaces it", async () => {
    const { store, sockets } = setup();
    store.dispatch({ type: "SHOW_CAST_PICKER" });
    await until(() => sockets.length === 1);
    sockets[0]?.open();
    expect(sockets[0]?.sent).toEqual([]);
    store.dispatch({ type: "SET_VIEW_URL", url: TV_PAGE });
    store.dispatch({ type: "SET_VIEW_URL", url: "https://kite.example/tv/WXYZ?t=x" });
    expect(sockets[0]?.sent).toEqual([
      ...startAndView(TV_PAGE),
      ...startAndView("https://kite.example/tv/WXYZ?t=x"),
    ]);
  });

  it("the launcher view stays the receiver's view (the page's URL never replaces it)", async () => {
    const { store, sockets } = setup();
    store.dispatch({ type: "SHOW_CAST_PICKER" });
    await until(() => sockets.length === 1);
    const launcher = store.getSnapshot().viewUrl;
    store.dispatch({ type: "SET_VIEW_URL", url: TV_PAGE });
    expect(store.getSnapshot().viewUrl).toBe(launcher);
  });

  it("ignores a view that isn't an absolute http(s) URL", async () => {
    const { store, sockets } = setup();
    store.dispatch({ type: "SHOW_CAST_PICKER" });
    await until(() => sockets.length === 1);
    sockets[0]?.open();
    store.dispatch({ type: "SET_VIEW_URL", url: "/tv/ABCD" });
    store.dispatch({ type: "SET_VIEW_URL", url: "javascript:alert(1)" });
    expect(sockets[0]?.sent).toEqual([]);
  });

  it("reconnects a dropped socket and says it again", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] });
    try {
      const { store, sockets } = setup();
      store.dispatch({ type: "SET_VIEW_URL", url: TV_PAGE });
      store.dispatch({ type: "SHOW_CAST_PICKER" });
      for (let i = 0; i < 20 && sockets.length === 0; i++) await Promise.resolve();
      sockets[0]?.open();
      sockets[0]?.drop();
      jest.advanceTimersByTime(1000);
      expect(sockets).toHaveLength(2);
      sockets[1]?.open();
      expect(sockets[1]?.sent).toEqual(startAndView(TV_PAGE));
    } finally {
      jest.useRealTimers();
    }
  });

  it("forwards a local http page (wrangler dev) but not text that merely contains a URL", async () => {
    const { store, sockets } = setup();
    store.dispatch({ type: "SHOW_CAST_PICKER" });
    await until(() => sockets.length === 1);
    sockets[0]?.open();
    store.dispatch({ type: "SET_VIEW_URL", url: "see https://kite.example/tv/ABCD" });
    expect(sockets[0]?.sent).toEqual([]);
    store.dispatch({ type: "SET_VIEW_URL", url: "http://192.168.1.5:8787/tv/ABCD?t=x" });
    expect(sockets[0]?.sent).toEqual(startAndView("http://192.168.1.5:8787/tv/ABCD?t=x"));
  });

  it("without a couch socket factory nothing is forwarded (the old single-cast behaviour)", async () => {
    const { store, sockets } = setup({ withCouch: false });
    store.dispatch({ type: "SET_VIEW_URL", url: TV_PAGE });
    store.dispatch({ type: "SHOW_CAST_PICKER" });
    await new Promise((r) => setTimeout(r, 20));
    expect(sockets).toHaveLength(0);
    expect(store.getSnapshot().viewUrl).not.toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
