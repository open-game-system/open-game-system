import { fakeFetch } from "../__fixtures__/fake-fetch";
import { fakeStorage } from "../__fixtures__/fake-storage";
import { castGameStores, DEFAULT_TV_BASE } from "../cast-stores";
import { createFakeCastBackend, FAKE_TV } from "../fake-cast";
import { createShellRuntime } from "../shell-runtime";

jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!check()) throw new Error("timed out");
};

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("castGameStores: the game's declared TV page reaches the couch session", () => {
  it("SET_VIEW_URL from the page goes out as game.start + game.view on the cast's couch socket", async () => {
    const net = fakeFetch({
      "POST /api/v1/profiles": () => ({
        status: 201,
        body: {
          profile: { id: "g", handle: "player", name: "Player", sticker: "owl" },
          token: "guest-token",
        },
      }),
      "POST /api/v1/sessions": () => ({
        status: 201,
        body: { sessionId: "s", token: "launcher-token" },
      }),
      "POST /load": () => ({ status: 200, body: {} }),
    });
    const backend = createFakeCastBackend({
      mode: "one",
      loadUrl: "https://fake-cast.test/load",
      fetch: net.fetch,
    });
    const sockets: {
      url: string;
      sent: string[];
      readyState: number;
      onopen: (() => void) | null;
    }[] = [];
    const openCouch = (url: string) => {
      const s = {
        url,
        sent: [] as string[],
        readyState: 0,
        onopen: null as (() => void) | null,
        onmessage: null,
        onclose: null,
        onerror: null,
        send(data: string) {
          this.sent.push(data);
        },
        close() {},
      };
      sockets.push(s);
      return s;
    };
    const runtime = createShellRuntime(
      {
        appId: "kite-count",
        gameUrl: "https://kite.example/host",
        name: "Kite Count",
        apiBase: "https://api.test",
        tvBase: "https://tv.test",
        linkDomains: [],
      },
      {
        fetch: net.fetch,
        storage: fakeStorage().storage,
        device: async () => ({ deviceId: "d", kind: "phone", name: "iPhone" }),
        notifications: {
          getPermissionsAsync: async () => ({ granted: false }),
          requestPermissionsAsync: async () => ({ granted: false }),
          getDevicePushTokenAsync: async () => ({ type: "ios", data: "t" }),
          addPushTokenListener: () => ({ remove: () => {} }),
        },
        platform: "ios",
        apnsEnvironment: async () => "production",
        haptics: { impact: async () => {}, notify: async () => {} },
        signInProviders: [],
        gameStores: castGameStores(backend, { streamServerUrl: "https://stream.test", openCouch }),
      },
    );
    await runtime.start();
    const send = (event: unknown) =>
      runtime.bridge.handleWebMessage(JSON.stringify({ type: "EVENT", storeKey: "cast", event }));
    await until(() => runtime.bridge.getStore("cast") !== undefined);
    send({ type: "SET_VIEW_URL", url: "https://kite.example/tv/ABCD?t=x" });
    send({ type: "SHOW_CAST_PICKER" });
    await until(() => sockets.length === 1);
    expect(sockets[0]?.url).toBe("wss://api.test/api/v1/couch/ws?token=guest-token&session=s");
    const socket = sockets[0];
    if (!socket) throw new Error("no socket");
    socket.readyState = 1;
    socket.onopen?.();
    expect(socket.sent.map((m) => JSON.parse(m))).toEqual([
      { type: "game.start", appId: "kite-count", mode: "new" },
      { type: "game.view", appId: "kite-count", url: "https://kite.example/tv/ABCD?t=x" },
    ]);
  });
});
