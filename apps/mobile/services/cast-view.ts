import { z } from "zod";

/**
 * Tells the OGS cast receiver which page to stream to the TV.
 *
 * The receiver (apps/web/public/receiver.html) listens on this namespace; when it gets LOAD_VIEW it
 * asks the stream server to render `viewUrl` and plays the result.
 */
export const CAST_VIEW_NAMESPACE = "urn:x-cast:org.opengame.view";

/** The production OGS API's stream route (the receiver's default when a sender names none). */
export const OGS_STREAM_SERVER_URL = "https://opengame-api.jonathanrmumm.workers.dev/api/v1/stream";

/**
 * The stream server the app names in LOAD_VIEW: EXPO_PUBLIC_OGS_STREAM when set, else the stream
 * route of the API the app was built against (EXPO_PUBLIC_OGS_API), so a production build casts
 * through the production API.
 */
export function streamServerUrl(
  env: { EXPO_PUBLIC_OGS_STREAM?: string | undefined },
  apiBase: string,
): string {
  const url = env.EXPO_PUBLIC_OGS_STREAM || `${apiBase}/api/v1/stream`;
  return url.replace(/\/+$/, "");
}

type ChannelMessage = Record<string, unknown> | string;

/** The slice of a react-native-google-cast CastSession this needs (keeps it testable). */
export type ViewChannelSession = {
  addChannel(namespace: string): Promise<{
    sendMessage(message: ChannelMessage): Promise<void>;
    onMessage(listener: (message: ChannelMessage) => void): void;
  }>;
};

const ViewRequestSchema = z.object({ type: z.literal("REQUEST_VIEW") });

/** Receiver messages arrive as objects or JSON strings; only REQUEST_VIEW matters here. */
function isViewRequest(message: ChannelMessage): boolean {
  let data: unknown = message;
  if (typeof message === "string") {
    try {
      data = JSON.parse(message);
    } catch {
      return false;
    }
  }
  return ViewRequestSchema.safeParse(data).success;
}

/**
 * Opens the view channel and keeps the receiver supplied: sends the view now, and again whenever the
 * receiver asks (REQUEST_VIEW). A cold-starting receiver isn't listening yet when the session starts,
 * so the first send can be lost; its request once ready is what makes the cast reliable.
 */
export async function connectViewChannel(
  session: ViewChannelSession,
  getViewUrl: () => string | null,
  streamServerUrl: string,
): Promise<{ send(): Promise<void> } | null> {
  try {
    const channel = await session.addChannel(CAST_VIEW_NAMESPACE);
    const send = async () => {
      const viewUrl = getViewUrl();
      if (!viewUrl) return;
      await channel
        .sendMessage({ type: "LOAD_VIEW", viewUrl, streamServerUrl })
        .catch((err: unknown) => {
          console.warn("[Cast] Could not send view to receiver:", err);
        });
    };
    channel.onMessage((message) => {
      if (isViewRequest(message)) void send();
    });
    await send();
    return { send };
  } catch (err) {
    console.warn("[Cast] Could not open the view channel:", err);
    return null;
  }
}
