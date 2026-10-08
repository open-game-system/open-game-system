import { type OgsNotification, OgsPushDataSchema } from "@open-game-system/ogs-protocol";

/** What the app knows when a push arrives in the foreground. */
export interface ForegroundContext {
  /** The game whose WebView is on screen, or null. */
  openAppId: string | null;
  /** Whether that page registered onOgsNotification. */
  listening: boolean;
}

/**
 * Banner or the page (spec §9, "Arriving while the game is open"): a game push for the game that is
 * open and listening, sent with whenOpen "deliver", goes to the page and shows no banner. Everything
 * else (another game, no handler, whenOpen "banner", an invite) shows as a banner.
 */
export function foregroundDecision(
  push: { data: unknown; title: string | null; body: string | null },
  ctx: ForegroundContext,
): { banner: boolean; toPage: OgsNotification | null } {
  const parsed = OgsPushDataSchema.safeParse(push.data);
  if (!parsed.success) return { banner: true, toPage: null };
  const data = parsed.data;
  const swallow = data.whenOpen === "deliver" && ctx.listening && data.appId === ctx.openAppId;
  if (!swallow) return { banner: true, toPage: null };
  const toPage: OgsNotification = {
    title: push.title ?? "",
    body: push.body ?? "",
    url: data.url,
    ...(data.tag ? { tag: data.tag } : {}),
  };
  return { banner: false, toPage };
}
