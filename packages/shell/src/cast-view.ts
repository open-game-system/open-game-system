import { z } from "zod";
import { type CastTrace, noTrace } from "./cast-trace";

/**
 * Tells the OGS cast receiver which page to show on the TV.
 *
 * The receiver (apps/web/public/receiver.html) listens on this namespace for LOAD_VIEW: `viewUrl`
 * is the page, `apiUrl` the OGS API its logs go to. There is no cloud renderer (ADR 2026-10-25).
 */
export const CAST_VIEW_NAMESPACE = "urn:x-cast:org.opengame.view";

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
 * so the first send can be lost; its request once ready is what makes the cast reliable. Each
 * LOAD_VIEW names the phone's cast attempt and the couch session (`context`), for the logs.
 */
export async function connectViewChannel(
  session: ViewChannelSession,
  getViewUrl: () => string | null,
  apiUrl: string,
  trace: CastTrace = noTrace,
  context: () => { sessionId?: string } = () => ({}),
): Promise<{ send(reason?: string): Promise<void> } | null> {
  try {
    const channel = await session.addChannel(CAST_VIEW_NAMESPACE);
    const send = async (reason = "change") => {
      const viewUrl = getViewUrl();
      if (!viewUrl) {
        trace.event("load_view.skipped", { level: "warn", data: { reason } });
        return;
      }
      // The view's host only: its query carries the launcher token.
      const data = { host: hostOf(viewUrl), reason };
      const t0 = trace.now();
      await channel.sendMessage(loadView(viewUrl, apiUrl, trace, context)).then(
        () => trace.event("load_view.sent", { durationMs: trace.now() - t0, data }),
        (err: unknown) => {
          trace.event("load_view.failed", { error: err, durationMs: trace.now() - t0, data });
          console.warn("[Cast] Could not send view to receiver:", err);
        },
      );
    };
    channel.onMessage((message) => {
      if (!isViewRequest(message)) return;
      trace.event("view_request.received");
      void send("request");
    });
    await send("connect");
    return { send };
  } catch (err) {
    trace.event("view_channel.failed", { error: err });
    console.warn("[Cast] Could not open the view channel:", err);
    return null;
  }
}

/**
 * LOAD_VIEW, with what lets Workers Logs join the TV's events to the phone's: the cast attempt
 * current on the phone (the receiver logs it as phoneAttemptId) and the couch session's id.
 */
function loadView(
  viewUrl: string,
  apiUrl: string,
  trace: CastTrace,
  context: () => { sessionId?: string },
): Record<string, string> {
  const msg: Record<string, string> = { type: "LOAD_VIEW", viewUrl, apiUrl };
  const attemptId = trace.current();
  const { sessionId } = context();
  if (attemptId) msg.attemptId = attemptId;
  if (sessionId) msg.sessionId = sessionId;
  return msg;
}

function hostOf(url: string): string {
  const match = url.match(/^[a-z]+:\/\/([^/?#]+)/i);
  return match ? match[1] : "unknown";
}
