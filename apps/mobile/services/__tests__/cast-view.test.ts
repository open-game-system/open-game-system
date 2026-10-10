import { createCastTrace } from "../cast-trace";
import {
  CAST_VIEW_NAMESPACE,
  connectViewChannel,
  OGS_STREAM_SERVER_URL,
  streamServerUrl,
} from "../cast-view";
import { noLog } from "../client-log";

type Msg = Record<string, unknown> | string;

function fakeSession() {
  const sent: Msg[] = [];
  let listener: ((m: Msg) => void) | null = null;
  const namespaces: string[] = [];
  return {
    sent,
    namespaces,
    fromReceiver: (m: Msg) => listener?.(m),
    session: {
      addChannel: async (ns: string) => {
        namespaces.push(ns);
        return {
          sendMessage: async (m: Msg) => {
            sent.push(m);
          },
          onMessage: (l: (m: Msg) => void) => {
            listener = l;
          },
        };
      },
    },
  };
}

const STREAM = "https://stream.example/api/v1/stream";

describe("connectViewChannel", () => {
  it("sends the view as soon as it connects", async () => {
    const f = fakeSession();
    await connectViewChannel(f.session, () => "https://game/tv/AB?stream=1", STREAM);
    expect(f.namespaces).toEqual([CAST_VIEW_NAMESPACE]);
    expect(f.sent).toEqual([
      { type: "LOAD_VIEW", viewUrl: "https://game/tv/AB?stream=1", streamServerUrl: STREAM },
    ]);
  });

  it("answers the receiver's REQUEST_VIEW (a cold-started receiver misses the first send)", async () => {
    const f = fakeSession();
    await connectViewChannel(f.session, () => "https://game/tv/AB?stream=1", STREAM);
    f.fromReceiver({ type: "REQUEST_VIEW" });
    await Promise.resolve();
    expect(f.sent).toHaveLength(2);
    expect(f.sent[1]).toMatchObject({ type: "LOAD_VIEW", viewUrl: "https://game/tv/AB?stream=1" });
  });

  it("answers with the latest view, and accepts string messages", async () => {
    const f = fakeSession();
    let url = "https://game/tv/AB?stream=1";
    await connectViewChannel(f.session, () => url, STREAM);
    url = "https://game/tv/CD?stream=1";
    f.fromReceiver(JSON.stringify({ type: "REQUEST_VIEW" }));
    await Promise.resolve();
    expect(f.sent[1]).toMatchObject({ viewUrl: "https://game/tv/CD?stream=1" });
  });

  it("LOAD_VIEW carries the phone's cast attempt id and the couch session id, for the receiver's logs", async () => {
    const f = fakeSession();
    const trace = createCastTrace(noLog);
    const attempt = trace.begin("cast");
    let sessionId = "couch-1";
    await connectViewChannel(
      f.session,
      () => "https://game/tv/AB",
      STREAM,
      trace,
      () => ({
        sessionId,
      }),
    );
    expect(f.sent[0]).toEqual({
      type: "LOAD_VIEW",
      viewUrl: "https://game/tv/AB",
      streamServerUrl: STREAM,
      attemptId: attempt,
      sessionId: "couch-1",
    });
    // A later send (the receiver asking again) names the attempt and session current then.
    const next = trace.begin("switch");
    sessionId = "couch-2";
    f.fromReceiver({ type: "REQUEST_VIEW" });
    await Promise.resolve();
    expect(f.sent[1]).toMatchObject({ attemptId: next, sessionId: "couch-2" });
  });

  it("no attempt or session yet: LOAD_VIEW has neither field", async () => {
    const f = fakeSession();
    await connectViewChannel(f.session, () => "https://game/tv/AB", STREAM, createCastTrace(noLog));
    expect(Object.keys(f.sent[0])).toEqual(["type", "viewUrl", "streamServerUrl"]);
  });

  it("stays quiet until the game has a view", async () => {
    const f = fakeSession();
    await connectViewChannel(f.session, () => null, STREAM);
    f.fromReceiver({ type: "REQUEST_VIEW" });
    await Promise.resolve();
    expect(f.sent).toEqual([]);
  });

  it("reports failure instead of throwing if the channel can't open", async () => {
    const session = {
      addChannel: async () => {
        throw new Error("receiver gone");
      },
    };
    await expect(
      connectViewChannel(session, () => "https://game/tv/AB", STREAM),
    ).resolves.toBeNull();
  });

  it("uses a urn:x-cast namespace", () => {
    expect(CAST_VIEW_NAMESPACE.startsWith("urn:x-cast:")).toBe(true);
  });

  it("ignores other receiver messages (LOG, STATUS)", async () => {
    const f = fakeSession();
    await connectViewChannel(f.session, () => "https://game/tv/AB?stream=1", STREAM);
    f.fromReceiver({ type: "LOG", message: "hi" });
    await Promise.resolve();
    expect(f.sent).toHaveLength(1);
  });
});

describe("the view channel when things go wrong", () => {
  afterEach(() => jest.restoreAllMocks());

  it("defaults to the production OGS API's stream route, which the receiver also uses", () => {
    expect(OGS_STREAM_SERVER_URL).toBe(
      "https://opengame-api.jonathanrmumm.workers.dev/api/v1/stream",
    );
  });

  it("ignores a receiver string that isn't JSON", async () => {
    const f = fakeSession();
    await connectViewChannel(f.session, () => "https://game/tv/AB", STREAM);
    expect(() => f.fromReceiver("REQUEST_VIEW")).not.toThrow();
    await Promise.resolve();
    expect(f.sent).toHaveLength(1);
  });

  it("logs a view the receiver didn't take, without throwing", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const err = new Error("receiver busy");
    const session = {
      addChannel: async () => ({
        sendMessage: async () => {
          throw err;
        },
        onMessage: () => {},
      }),
    };
    const channel = await connectViewChannel(session, () => "https://game/tv/AB", STREAM);
    expect(channel).not.toBeNull();
    expect(warn).toHaveBeenCalledWith("[Cast] Could not send view to receiver:", err);
  });

  it("logs a channel that can't open", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const err = new Error("receiver gone");
    await connectViewChannel(
      {
        addChannel: async () => {
          throw err;
        },
      },
      () => "https://game/tv/AB",
      STREAM,
    );
    expect(warn).toHaveBeenCalledWith("[Cast] Could not open the view channel:", err);
  });
});

describe("which stream server the app sends the receiver", () => {
  it("is the stream route of the API the app was built against", () => {
    expect(streamServerUrl({}, "https://opengame-api.jonathanrmumm.workers.dev")).toBe(
      "https://opengame-api.jonathanrmumm.workers.dev/api/v1/stream",
    );
  });

  it("EXPO_PUBLIC_OGS_STREAM overrides it (trailing slashes trimmed)", () => {
    expect(
      streamServerUrl(
        { EXPO_PUBLIC_OGS_STREAM: "https://stream.example/api/v1/stream/" },
        "https://api.example",
      ),
    ).toBe("https://stream.example/api/v1/stream");
  });

  it("an empty override falls back to the API's stream route", () => {
    expect(streamServerUrl({ EXPO_PUBLIC_OGS_STREAM: "" }, "https://api.example")).toBe(
      "https://api.example/api/v1/stream",
    );
  });
});
