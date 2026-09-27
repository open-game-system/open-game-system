/**
 * Tells the OGS cast receiver which page to stream to the TV.
 *
 * The receiver (apps/web/public/receiver.html) listens on this namespace; when it gets LOAD_VIEW it
 * asks the stream server to render `viewUrl` and plays the result.
 */
export const CAST_VIEW_NAMESPACE = "urn:x-cast:org.opengame.view";

/** Default OGS stream server (the receiver uses the same default). */
export const OGS_STREAM_SERVER_URL = "https://opengame-api-pr-5.jonathanrmumm.workers.dev/api/v1/stream";

/** The slice of a react-native-google-cast CastSession this needs (keeps it testable). */
export type ViewChannelSession = {
  addChannel(namespace: string): Promise<{ sendMessage(message: Record<string, unknown> | string): Promise<void> }>;
};

export async function sendViewToReceiver(session: ViewChannelSession, viewUrl: string | null, streamServerUrl: string): Promise<boolean> {
  if (!viewUrl) return false;
  try {
    const channel = await session.addChannel(CAST_VIEW_NAMESPACE);
    await channel.sendMessage({ type: "LOAD_VIEW", viewUrl, streamServerUrl });
    return true;
  } catch (err) {
    console.warn("[Cast] Could not send view to receiver:", err);
    return false;
  }
}
