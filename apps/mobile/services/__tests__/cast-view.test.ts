import { CAST_VIEW_NAMESPACE, sendViewToReceiver, type ViewChannelSession } from "../cast-view";

function fakeSession() {
  const sent: unknown[] = [];
  const channels: string[] = [];
  const session: ViewChannelSession = {
    addChannel: async (namespace: string) => {
      channels.push(namespace);
      return { sendMessage: async (m: Record<string, unknown> | string) => void sent.push(m) };
    },
  };
  return { session, sent, channels };
}

describe("sendViewToReceiver", () => {
  it("opens the OGS view channel and sends the game's TV page", async () => {
    const { session, sent, channels } = fakeSession();
    const ok = await sendViewToReceiver(session, "https://game.example/tv/ABCD", "https://api.example/api/v1/stream");
    expect(ok).toBe(true);
    expect(channels).toEqual([CAST_VIEW_NAMESPACE]);
    expect(sent).toEqual([{ type: "LOAD_VIEW", viewUrl: "https://game.example/tv/ABCD", streamServerUrl: "https://api.example/api/v1/stream" }]);
  });

  it("sends nothing when the game hasn't set a view URL", async () => {
    const { session, sent } = fakeSession();
    expect(await sendViewToReceiver(session, null, "https://api.example/api/v1/stream")).toBe(false);
    expect(sent).toEqual([]);
  });

  it("reports failure instead of throwing if the channel can't open", async () => {
    const session: ViewChannelSession = {
      addChannel: async () => {
        throw new Error("receiver gone");
      },
    };
    expect(await sendViewToReceiver(session, "https://game.example/tv", "https://api.example")).toBe(false);
  });

  it("uses a urn:x-cast namespace", () => {
    expect(CAST_VIEW_NAMESPACE.startsWith("urn:x-cast:")).toBe(true);
  });
});
