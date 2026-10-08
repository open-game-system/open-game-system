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

type PushManagerLike = {
  getSubscription(): Promise<SubscriptionLike | null>;
  subscribe(opts: {
    userVisibleOnly: true;
    applicationServerKey: Uint8Array<ArrayBuffer>;
  }): Promise<SubscriptionLike>;
};

/** The browser parts used (a fake in tests; `browserEnv()` in a page). */
export interface BrowserEnv {
  serviceWorker: { register(url: string): Promise<{ pushManager: PushManagerLike }> } | undefined;
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

/** Whether a subscription was made with this key (the key rotates: then it must be remade). */
export const madeWith = (sub: SubscriptionLike, key: Uint8Array): boolean =>
  new Uint8Array(sub.options?.applicationServerKey ?? new ArrayBuffer(0)).join() === key.join();

/** The response's JSON when OGS answered 2xx; null otherwise. */
const okJson = async (res: Response): Promise<unknown> => (res.ok ? res.json() : null);

/** The subscription to hand OGS: the current one if it uses this key, else a new one. */
async function subscriptionFor(
  push: PushManagerLike,
  key: Uint8Array<ArrayBuffer>,
): Promise<SubscriptionLike> {
  const existing = await push.getSubscription();
  if (existing && madeWith(existing, key)) return existing;
  await existing?.unsubscribe();
  return push.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

type Sw = NonNullable<BrowserEnv["serviceWorker"]>;

/** Register sw.js, subscribe with the game's key and hand OGS the subscription (permission granted). */
async function optIn(
  sw: Sw,
  env: BrowserEnv,
  api: string,
  opts: SubscribeOptions,
): Promise<WebPushConsent> {
  try {
    const registration = await sw.register(opts.serviceWorkerUrl ?? "/sw.js");
    const { publicKey } = z
      .object({ publicKey: z.string() })
      .parse(await okJson(await env.fetch(`${api}/push-key`)));
    const subscription = await subscriptionFor(registration.pushManager, bytes(publicKey));
    const join = opts.handle ? { handle: opts.handle } : {};
    const answer = await env.fetch(`${api}/push-subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON(), ...join }),
    });
    return PushConsentResultSchema.parse(await okJson(answer));
  } catch {
    return { status: "unsupported", reason: "unavailable" };
  }
}

export async function subscribeOgsPush(
  opts: SubscribeOptions,
  env: BrowserEnv = browserEnv(),
): Promise<WebPushConsent> {
  const sw = env.pushSupported ? env.serviceWorker : undefined;
  if (!sw)
    return {
      status: "unsupported",
      reason: env.isIosBrowserTab ? "add-to-home-screen" : "no-push",
    };
  // First, while the tap still counts: iOS only shows the prompt from a user gesture.
  if ((await env.permission()) !== "granted") return { status: "denied" };
  return optIn(
    sw,
    env,
    `${opts.apiUrl ?? DEFAULT_OGS_API_URL}/api/v1/games/${encodeURIComponent(opts.appId)}`,
    opts,
  );
}

/** iPhone or iPad (iPadOS reports a Mac user agent; touch tells them apart). */
export const isIos = (nav: { userAgent: string; maxTouchPoints: number }): boolean =>
  /iPad|iPhone|iPod/.test(nav.userAgent) ||
  (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);

/** The parts of the page's globals browserEnv reads (globalThis in a page; a fake in tests). */
export interface PageGlobals {
  navigator?: {
    userAgent: string;
    maxTouchPoints: number;
    serviceWorker?: BrowserEnv["serviceWorker"];
  };
  matchMedia?: (query: string) => { matches: boolean };
  Notification?: { requestPermission(): Promise<"granted" | "denied" | "default"> };
  PushManager?: unknown;
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

/** The real browser, read when called (never at import, so server rendering is safe). */
export function browserEnv(g: PageGlobals = globalThis): BrowserEnv {
  const nav = g.navigator;
  const standalone = g.matchMedia?.("(display-mode: standalone)").matches === true;
  return {
    serviceWorker: nav?.serviceWorker,
    pushSupported: g.PushManager !== undefined,
    isIosBrowserTab: nav !== undefined && isIos(nav) && !standalone,
    permission: async () => (g.Notification ? g.Notification.requestPermission() : "denied"),
    fetch: (url, init) => g.fetch(url, init),
  };
}
