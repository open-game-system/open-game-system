import { buildPushPayload } from "@block65/webcrypto-web-push";
import type { WebPushPayload } from "@open-game-system/ogs-protocol";
import { base64url } from "./base64url";
import type { WebSendResult, WebSubscriptionRow } from "./push-delivery";
import type { VapidKeyPair } from "./vapid-keys";

/** How long a push service keeps an undelivered push (a day: a turn can wait). */
export const WEB_PUSH_TTL_S = 24 * 60 * 60;

/** RFC 8030 topic: at most 32 url-safe base64 characters, so a hash of the tag. */
export async function webPushTopic(tag: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tag));
  return base64url(new Uint8Array(digest)).slice(0, 32);
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Sends one web push (RFC 8291 aes128gcm, RFC 8292 VAPID) to a subscription with the game's VAPID
 * keys. `ok`: the push service took it; `gone`: 404/410, the subscription no longer exists; `error`:
 * anything else (rate limits, a bad subscription, the network).
 */
export async function sendWebPush(
  sub: WebSubscriptionRow,
  payload: WebPushPayload,
  vapid: VapidKeyPair,
  opts: { subject: string; fetch?: Fetch },
): Promise<WebSendResult> {
  const doFetch: Fetch = opts.fetch ?? ((url, init) => fetch(url, init));
  try {
    const topic = payload.tag ? await webPushTopic(payload.tag) : undefined;
    const request = await buildPushPayload(
      { data: payload, options: { ttl: WEB_PUSH_TTL_S, urgency: "normal", ...(topic ? { topic } : {}) } },
      { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      { subject: opts.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    );
    const res = await doFetch(sub.endpoint, request);
    if (res.ok) return "ok";
    return res.status === 404 || res.status === 410 ? "gone" : "error";
  } catch {
    return "error";
  }
}
