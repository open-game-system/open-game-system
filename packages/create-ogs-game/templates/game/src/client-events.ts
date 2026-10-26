import { z } from "zod";

/**
 * Client logs: the TV and phone pages POST their errors and milestones to `/events`; the Worker
 * writes each as one JSON line in Workers Logs (`wrangler tail`, the dashboard, sre-agent). The
 * app shell's own log (AirPlay steps, native events) goes to the OGS API instead: README "Logs".
 */
export const ClientEventSchema = z.object({
  name: z.string().min(1).max(80),
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  page: z.enum(["tv", "phone"]),
  room: z.string().max(8).optional(),
  message: z.string().max(2000).optional(),
  stack: z.string().max(4000).optional(),
  data: z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional(),
});
export const ClientEventBatchSchema = z.object({ events: z.array(ClientEventSchema).min(1).max(50) });
export type ClientEvent = z.infer<typeof ClientEventSchema>;

const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

/** One wide event per client event, with tokens redacted (a URL can carry `t=` or an OGS token). */
export function logLines(body: unknown, meta: { appId: string; userAgent: string }): string[] | null {
  const parsed = ClientEventBatchSchema.safeParse(body);
  if (!parsed.success) return null;
  return parsed.data.events.map((e) =>
    JSON.stringify({ kind: "client_event", app: meta.appId, ua: meta.userAgent.slice(0, 200), ...e })
      .replace(JWT, "[jwt]")
      .replace(/([?&](?:t|tv|accessToken)=)[^&"\\]+/g, "$1[redacted]"),
  );
}
