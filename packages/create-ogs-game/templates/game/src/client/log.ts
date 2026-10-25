import type { ClientEvent } from "../client-events";

type Fields = Omit<ClientEvent, "page" | "room" | "level"> & { level?: ClientEvent["level"] };

/**
 * The page's client log: errors and milestones, batched and POSTed to the game's own Worker
 * (`/events`, one wide event per line in Workers Logs). Uncaught errors and rejections are caught.
 */
export function startClientLog(page: ClientEvent["page"], room: string, send: typeof fetch = fetch) {
  let queue: ClientEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (queue.length === 0) return;
    const events = queue.slice(0, 50);
    queue = queue.slice(50);
    void send("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(() => {});
  };
  const log = (fields: Fields) => {
    queue.push({ page, room, level: "info", ...fields });
    if (!timer) timer = setTimeout(flush, 2000);
  };
  addEventListener("error", (e) => log({ name: `${page}.error`, level: "error", message: e.message, stack: e.error instanceof Error ? e.error.stack : undefined }));
  addEventListener("unhandledrejection", (e) =>
    log({ name: `${page}.unhandled_rejection`, level: "error", message: e.reason instanceof Error ? e.reason.message : String(e.reason) }),
  );
  addEventListener("pagehide", flush);
  return log;
}
