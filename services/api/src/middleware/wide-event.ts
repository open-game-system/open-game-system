import type { Context, Next } from "hono";
import { routePath } from "hono/route";
import { apiError } from "../lib/http";
import { beginRequestEvent, emit, errorFields, versionOf } from "../lib/wide-event";
import type { Env } from "../types";

/**
 * One `http.request` wide event per request, emitted once the response is ready. The route is
 * the matched pattern (`/api/v1/sessions/:sid`), never the path with its ids or query (tokens
 * travel in `?token=` on WebSocket upgrades). A thrown error or a 5xx answer is an error line.
 */
export async function wideEvent(c: Context<{ Bindings: Env }>, next: Next) {
  const started = Date.now();
  const fields = beginRequestEvent(c.req.raw);
  await next();
  const status = c.res.status;
  const route = routePath(c, -1);
  const failed = c.error !== undefined || status >= 500;
  const { error: recorded, ...context } = fields;
  const line = {
    ...context,
    request_id: c.req.header("cf-ray") ?? crypto.randomUUID(),
    method: c.req.method,
    route,
    status,
    duration_ms: Date.now() - started,
  };
  if (!failed) {
    emit("http.request", versionOf(c.env), line, "ok");
    return;
  }
  const error = c.error
    ? errorFields(c.error)
    : (recorded ?? { type: "HttpError", message: `${status} ${c.req.method} ${route}` });
  emit("http.request", versionOf(c.env), { ...line, error }, "error");
}

/** Unhandled errors answer the API's error contract; the wide event above logs them (once). */
export function onError(_error: Error, c: Context) {
  return apiError(c, 500, "internal_error", "Something went wrong");
}
