import { PushConsentResultSchema } from "@open-game-system/ogs-protocol";
import { z } from "zod";

/**
 * Opting in from a game's own site (spec §9, "In the game's PWA or tab"). Call it from a tap: it asks
 * the browser first, then registers OGS's sw.js, subscribes with the game's VAPID key (held by OGS)
 * and hands OGS the subscription, which answers the push handle.
 */
export type WebPushConsent =
  | { status: "granted"; handle: string }
  | { status: "denied" }
  /** add-to-home-screen: a Safari tab on iOS (web push needs a Home Screen app); no-push: this browser
   * has none; unavailable: OGS can't take subscriptions right now. */
  | { status: "unsupported"; reason: "add-to-home-screen" | "no-push" | "unavailable" };

type SubscriptionLike = {
  options?: { applicationServerKey: ArrayBuffer | null };
  toJSON(): unknown;
  unsubscribe(): Promise<boolean>;
};

/** The browser parts used (a fake in tests; `browserEnv()` in a page). */
export interface BrowserEnv {
  serviceWorker:
    | {
        register(url: string): Promise<{
          pushManager: {
            getSubscription(): Promise<SubscriptionLike | null>;
            subscribe(opts: {
              userVisibleOnly: true;
              applicationServerKey: Uint8Array<ArrayBuffer>;
            }): Promise<SubscriptionLike>;
          };
        }>;
      }
    | undefined;
  pushSupported: boolean;
  /** iPhone or iPad Safari, not a Home Screen app. */
  isIosBrowserTab: boolean;
  permission(): Promise<"granted" | "denied" | "default">;
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export interface SubscribeOptions {
  appId: string;
  /** A handle this player already has (from the OGS app): the subscription joins it. */
  handle?: string;
  /** The OGS API (default https://api.opengame.org). */
  apiUrl?: string;
  /** Where the game serves OGS's sw.js (default /sw.js, the origin root). */
  serviceWorkerUrl?: string;
}

export const DEFAULT_OGS_API_URL = "https://api.opengame.org";

const bytes = (b64url: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(b64url.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const sameKey = (key: ArrayBuffer | null | undefined, want: Uint8Array) =>
  key != null && new Uint8Array(key).join() === want.join();

const unavailable: WebPushConsent = { status: "unsupported", reason: "unavailable" };

async function json(env: BrowserEnv, url: string, init?: RequestInit): Promise<unknown> {
  const res = await env.fetch(url, init);
  if (!res.ok) throw new Error(`OGS answered ${res.status}`);
  return res.json();
}

export async function subscribeOgsPush(
  opts: SubscribeOptions,
  env: BrowserEnv = browserEnv(),
): Promise<WebPushConsent> {
  if (!env.serviceWorker || !env.pushSupported)
    return {
      status: "unsupported",
      reason: env.isIosBrowserTab ? "add-to-home-screen" : "no-push",
    };
  // First, while the tap still counts: iOS only shows the prompt from a user gesture.
  if ((await env.permission()) !== "granted") return { status: "denied" };
  const api = `${opts.apiUrl ?? DEFAULT_OGS_API_URL}/api/v1/games/${encodeURIComponent(opts.appId)}`;
  try {
    const registration = await env.serviceWorker.register(opts.serviceWorkerUrl ?? "/sw.js");
    const { publicKey } = z
      .object({ publicKey: z.string() })
      .parse(await json(env, `${api}/push-key`));
    const key = bytes(publicKey);
    const existing = await registration.pushManager.getSubscription();
    const current =
      existing && sameKey(existing.options?.applicationServerKey, key) ? existing : null;
    if (existing && !current) await existing.unsubscribe();
    const subscription =
      current ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }));
    const answer = await json(env, `${api}/push-subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        ...(opts.handle ? { handle: opts.handle } : {}),
      }),
    });
    return PushConsentResultSchema.parse(answer);
  } catch {
    return unavailable;
  }
}

/** The real browser, read when called (never at import, so server rendering is safe). */
export function browserEnv(): BrowserEnv {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  // iPadOS reports a Mac user agent; touch tells them apart.
  const ios =
    nav !== undefined &&
    (/iPad|iPhone|iPod/.test(nav.userAgent) ||
      (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1));
  const standalone =
    typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches;
  return {
    serviceWorker: nav && "serviceWorker" in nav ? nav.serviceWorker : undefined,
    pushSupported: typeof window !== "undefined" && "PushManager" in window,
    isIosBrowserTab: ios && !standalone,
    permission: async () =>
      typeof Notification === "undefined" ? "denied" : Notification.requestPermission(),
    fetch: (url, init) => fetch(url, init),
  };
}
