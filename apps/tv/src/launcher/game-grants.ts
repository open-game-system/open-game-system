import { GamePlayerSchema } from "@open-game-system/ogs-protocol";
import { z } from "zod";
import type { StartGrant } from "./frames";

const GrantSchema = z.object({
  token: z.string().min(1),
  players: z.array(GamePlayerSchema),
  expiresAt: z.number(),
});
export type SessionGrant = StartGrant & { expiresAt: number };

/** Ask again this long before a cached token expires. */
const MARGIN_MS = 5 * 60 * 1000;

/**
 * The session's game tokens (POST /sessions/:sid/game-token, launcher token): one per game, cached
 * until 5 minutes before it expires. Null when OGS can't give one (the game then starts without).
 */
export function createGameGrants(opts: {
  api: string;
  token: string;
  sessionId: string;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  now?: () => number;
}): (appId: string) => Promise<SessionGrant | null> {
  const f = opts.fetch ?? ((url, init) => fetch(url, init));
  const now = opts.now ?? Date.now;
  const cache = new Map<string, SessionGrant>();
  const url = `${opts.api}/api/v1/sessions/${encodeURIComponent(opts.sessionId)}/game-token`;
  return async (appId) => {
    const hit = cache.get(appId);
    if (hit && hit.expiresAt - MARGIN_MS > now()) return hit;
    try {
      const res = await f(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ appId }),
      });
      if (!res.ok) return null;
      const parsed = GrantSchema.safeParse(await res.json());
      if (!parsed.success) return null;
      cache.set(appId, parsed.data);
      return parsed.data;
    } catch {
      return null;
    }
  };
}
