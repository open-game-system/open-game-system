import {
  type OgsNotification,
  type ServiceWorkerNotificationMessage,
  WebPushPayloadSchema,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";

/**
 * What OGS's sw.js does (spec §9, "Arriving while the game is open"), as plain functions over the
 * parts of the service worker it uses, so they can be tested without a browser.
 */

/** How long the page may take to say it handled a push before the notification shows anyway. */
export const PAGE_ANSWER_MS = 1000;

/** The end of a MessageChannel handed to the page; it answers on it. */
type SendPort = { postMessage(message: unknown): void };
type Channel = { send: SendPort; onAnswer(listener: (data: unknown) => void): void };

/** A window of the game, as the service worker sees it (a WindowClient). */
export interface ClientLike {
  url: string;
  focused: boolean;
  postMessage(message: ServiceWorkerNotificationMessage, ports: SendPort[]): void;
  focus(): Promise<unknown>;
  navigate(url: string): Promise<unknown>;
}

export interface PushDeps {
  /** The game's open windows (clients.matchAll({ type: "window", includeUncontrolled: true })). */
  clients(): Promise<ClientLike[]>;
  show(
    title: string,
    options: { body: string; tag?: string; data: { url: string } },
  ): Promise<void>;
  wait(ms: number): Promise<void>;
  /** A MessageChannel (injected in tests). */
  channel?: () => Channel;
}

const realChannel = (): Channel => {
  const c = new MessageChannel();
  return {
    send: c.port2,
    onAnswer(listener) {
      c.port1.onmessage = (ev) => listener(ev.data);
    },
  };
};

/** Asks the focused window whether it handled the push; false when it doesn't answer in time. */
async function pageHandled(
  client: ClientLike,
  notification: OgsNotification,
  deps: PushDeps,
): Promise<boolean> {
  const { send, onAnswer } = (deps.channel ?? realChannel)();
  const answered = new Promise<boolean>((resolve) => {
    onAnswer((data) => resolve(z.object({ handled: z.literal(true) }).safeParse(data).success));
  });
  client.postMessage({ type: "ogs:notification", notification }, [send]);
  return Promise.race([answered, deps.wait(PAGE_ANSWER_MS).then(() => false)]);
}

const parsePayload = (raw: string | null) => {
  try {
    const parsed = WebPushPayloadSchema.safeParse(JSON.parse(raw ?? ""));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** The push event: hand it to a focused window that handles it, or show the notification. */
export async function handlePush(raw: string | null, deps: PushDeps): Promise<void> {
  const payload = parsePayload(raw);
  if (!payload) return;
  const { whenOpen, ...notification } = payload;
  if (whenOpen === "deliver") {
    const focused = (await deps.clients()).find((c) => c.focused);
    if (focused && (await pageHandled(focused, notification, deps))) return;
  }
  const tag = notification.tag ? { tag: notification.tag } : {};
  await deps.show(notification.title, {
    body: notification.body,
    ...tag,
    data: { url: notification.url },
  });
}

const ClickDataSchema = z.object({ url: z.string() });

/** A tap: focus the window on that page, else take a window of the game there, else open one. */
export async function handleClick(
  data: unknown,
  deps: { clients(): Promise<ClientLike[]>; open(url: string): Promise<unknown> },
): Promise<void> {
  const parsed = ClickDataSchema.safeParse(data);
  if (!parsed.success) return;
  const { url } = parsed.data;
  const windows = await deps.clients();
  const there = windows.find((c) => c.url === url);
  if (there) {
    await there.focus();
    return;
  }
  const any = windows[0];
  if (any) {
    await any.navigate(url);
    await any.focus();
    return;
  }
  await deps.open(url);
}
