import { ClaimsSchema } from "@open-game-system/ogs-protocol";
import { z } from "zod";

/** `/?api=<API base>&token=<launcher JWT>`, or `/?fake=1` for an in-browser session. */
const LiveSchema = z.object({
  api: z
    .string()
    .url()
    .transform((u) => u.replace(/\/+$/, "")),
  token: z.string().min(1),
});

export type LauncherParams =
  | { mode: "fake"; hold: boolean }
  | { mode: "live"; api: string; token: string };

/** Knobs for tests and design: how long a frame may take to load before the launcher gives up. */
export function frameTimeoutMs(search: string): number {
  const n = Number(new URLSearchParams(search).get("frameTimeout"));
  return Number.isFinite(n) && n > 0 ? n : 20_000;
}
export type ParamsResult = { ok: true; params: LauncherParams } | { ok: false; error: string };

export function parseParams(search: string): ParamsResult {
  const q = new URLSearchParams(search);
  if (q.get("fake") === "1")
    return { ok: true, params: { mode: "fake", hold: q.get("hold") === "1" } };
  const r = LiveSchema.safeParse({
    api: q.get("api") ?? undefined,
    token: q.get("token") ?? undefined,
  });
  if (!r.success)
    return { ok: false, error: r.error.issues.map((i) => i.path.join(".")).join(", ") };
  return { ok: true, params: { mode: "live", ...r.data } };
}

export function wsUrl(api: string, token: string): string {
  const base = api.replace(/^http/, "ws");
  return `${base}/api/v1/couch/ws?token=${encodeURIComponent(token)}`;
}

function decodeSegment(seg: string): unknown {
  const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** The household id from the launcher token's `hid` claim. Not verified here: the API does that. */
export function householdOf(token: string): string | null {
  const seg = token.split(".")[1];
  if (!seg) return null;
  try {
    const claims = ClaimsSchema.pick({ hid: true }).safeParse(decodeSegment(seg));
    return claims.success ? claims.data.hid : null;
  } catch {
    return null;
  }
}
