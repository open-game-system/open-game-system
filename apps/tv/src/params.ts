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
  | { mode: "fake"; hold: boolean; fresh?: true }
  | { mode: "live"; api: string; token: string; sessionId: string };

/** Knobs for tests and design: how long a frame may take to load before the launcher gives up. */
export function frameTimeoutMs(search: string): number {
  const n = Number(new URLSearchParams(search).get("frameTimeout"));
  return Number.isFinite(n) && n > 0 ? n : 20_000;
}
export type ParamsResult = { ok: true; params: LauncherParams } | { ok: false; error: string };

export function parseParams(search: string): ParamsResult {
  const q = new URLSearchParams(search);
  if (q.get("fake") === "1") {
    const hold = q.get("hold") === "1";
    // `world=fresh`: the evening before anyone has played anything (design and tests).
    const params: LauncherParams =
      q.get("world") === "fresh" ? { mode: "fake", hold, fresh: true } : { mode: "fake", hold };
    return { ok: true, params };
  }
  const r = LiveSchema.safeParse({
    api: q.get("api") ?? undefined,
    token: q.get("token") ?? undefined,
  });
  if (!r.success)
    return { ok: false, error: r.error.issues.map((i) => i.path.join(".")).join(", ") };
  const sessionId = launcherSessionOf(r.data.token);
  if (!sessionId) return { ok: false, error: "token: not a launcher token" };
  return { ok: true, params: { mode: "live", ...r.data, sessionId } };
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

/** The couch session a launcher token is for (its `sid` claim). Not verified here: the API does that. */
export function launcherSessionOf(token: string): string | null {
  const seg = token.split(".")[1];
  if (!seg) return null;
  try {
    const claims = ClaimsSchema.safeParse(decodeSegment(seg));
    return claims.success && claims.data.kind === "launcher" ? (claims.data.sid ?? null) : null;
  } catch {
    return null;
  }
}
