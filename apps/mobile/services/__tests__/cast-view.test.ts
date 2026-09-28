import { CAST_VIEW_NAMESPACE, connectViewChannel } from "../cast-view";

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
    expect(f.sent).toEqual([{ type: "LOAD_VIEW", viewUrl: "https://game/tv/AB?stream=1", streamServerUrl: STREAM }]);
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
    await expect(connectViewChannel(session, () => "https://game/tv/AB", STREAM)).resolves.toBeNull();
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
