import {
  type GameNotificationRequest,
  GameNotificationRequestSchema,
  type GameNotificationResult,
  GameNotificationResultSchema,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";

/**
 * Game pushes from a game's server (spec §9): one call to OGS with the game's API key, to the push
 * handles the game keeps per seat. OGS delivers to the OGS app or the game's PWA.
 */
export type { GameNotificationResult };
export type NotifyInput = z.input<typeof GameNotificationRequestSchema>;

export const DEFAULT_OGS_API_URL = "https://api.opengame.org";

export interface OgsNotifierOptions {
  appId: string;
  /** The game's OGS API key (a secret, e.g. OGS_API_KEY). */
  apiKey: string;
  /** The OGS API (default https://api.opengame.org). */
  baseUrl?: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

/** OGS refused the send: its error code (`wrong_game`, `invalid_api_key`…) and HTTP status. */
export class OgsNotifyError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OgsNotifyError";
  }
}

const ErrorBodySchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

/** The body as JSON, or null when it isn't JSON. */
const readJson = (res: Response): Promise<unknown> =>
  res.json().then(
    (json: unknown) => json,
    () => null,
  );

export function createOgsNotifier(opts: OgsNotifierOptions) {
  const doFetch = opts.fetch ?? ((url: string, init: RequestInit) => fetch(url, init));
  const url = `${opts.baseUrl ?? DEFAULT_OGS_API_URL}/api/v1/games/${encodeURIComponent(opts.appId)}/notifications`;
  return async function notify(input: NotifyInput): Promise<GameNotificationResult> {
    const body: GameNotificationRequest = GameNotificationRequestSchema.parse(input);
    const res = await doFetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await readJson(res);
    if (!res.ok) {
      const err = ErrorBodySchema.safeParse(json);
      if (err.success)
        throw new OgsNotifyError(err.data.error.code, err.data.error.message, res.status);
      throw new OgsNotifyError("http_error", `OGS answered HTTP ${res.status}`, res.status);
    }
    return GameNotificationResultSchema.parse(json);
  };
}
