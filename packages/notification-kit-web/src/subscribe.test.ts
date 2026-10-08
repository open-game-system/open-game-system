import { describe, expect, it } from "vitest";
import { type BrowserEnv, subscribeOgsPush } from "./subscribe";

/** A 65-byte uncompressed P-256 point, base64url (the shape OGS answers). */
const keyOf = (fill: number) =>
  btoa(String.fromCharCode(4, ...new Array(64).fill(fill)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const KEY = keyOf(0xfb);
const OTHER = keyOf(0x11);
const handle = "ph_abcdefghijklmnop";
const keyBytes = (k: string) =>
  Uint8Array.from(atob(k.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function fakeSub(key: string, endpoint = "https://push.example.net/1") {
  const state = { unsubscribed: false };
  const options: { applicationServerKey: ArrayBuffer | null } = {
    applicationServerKey: keyBytes(key).buffer,
  };
  return {
    state,
    sub: {
      options,
      toJSON: () => ({ endpoint, keys: { p256dh: "p", auth: "a" } }),
      unsubscribe: async () => {
        state.unsubscribed = true;
        return true;
      },
    },
  };
}

function env(
  over: Partial<BrowserEnv> & {
    existing?: ReturnType<typeof fakeSub>["sub"] | null;
    answer?: unknown;
  } = {},
) {
  const log: string[] = [];
  const posted: unknown[] = [];
  const fresh = fakeSub(KEY, "https://push.example.net/new");
  const e: BrowserEnv = {
    serviceWorker: {
      register: async (url) => {
        log.push(`register:${url}`);
        return {
          pushManager: {
            getSubscription: async () => over.existing ?? null,
            subscribe: async (opts) => {
              log.push(`subscribe:${opts.userVisibleOnly}:${opts.applicationServerKey.length}`);
              return fresh.sub;
            },
          },
        };
      },
    },
    pushSupported: true,
    isIosBrowserTab: false,
    permission: async () => {
      log.push("permission");
      return "granted";
    },
    fetch: async (url, init) => {
      log.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/push-key")) return Response.json({ publicKey: KEY });
      posted.push(JSON.parse(String(init?.body)));
      return Response.json(over.answer ?? { status: "granted", handle });
    },
    ...over,
  };
  return { e, log, posted };
}

const opts = { appId: "codebreakers", apiUrl: "https://api.test" };

describe("subscribeOgsPush", () => {
  it("asks permission first (from the tap), then registers, subscribes with the game's key and posts it", async () => {
    const f = env();
    await expect(subscribeOgsPush(opts, f.e)).resolves.toEqual({ status: "granted", handle });
    expect(f.log).toEqual([
      "permission",
      "register:/sw.js",
      "GET https://api.test/api/v1/games/codebreakers/push-key",
      "subscribe:true:65",
      "POST https://api.test/api/v1/games/codebreakers/push-subscriptions",
    ]);
    expect(f.posted).toEqual([
      {
        subscription: {
          endpoint: "https://push.example.net/new",
          keys: { p256dh: "p", auth: "a" },
        },
      },
    ]);
  });

  it("passes the handle to join, and a custom worker path", async () => {
    const f = env();
    await subscribeOgsPush({ ...opts, handle, serviceWorkerUrl: "/push/sw.js" }, f.e);
    expect(f.log[1]).toBe("register:/push/sw.js");
    expect(f.posted[0]).toMatchObject({ handle });
  });

  it("reuses a subscription made with the current key (each load)", async () => {
    const existing = fakeSub(KEY, "https://push.example.net/kept");
    const f = env({ existing: existing.sub });
    await subscribeOgsPush(opts, f.e);
    expect(f.log.some((l) => l.startsWith("subscribe"))).toBe(false);
    expect(existing.state.unsubscribed).toBe(false);
    expect(f.posted[0]).toEqual({
      subscription: { endpoint: "https://push.example.net/kept", keys: { p256dh: "p", auth: "a" } },
    });
  });

  it("re-subscribes when OGS rotated the key", async () => {
    const old = fakeSub(OTHER);
    const f = env({ existing: old.sub });
    await subscribeOgsPush(opts, f.e);
    expect(old.state.unsubscribed).toBe(true);
    expect(f.log).toContain("subscribe:true:65");
  });

  it("an old subscription with no key is replaced", async () => {
    const old = fakeSub(KEY);
    const f = env({ existing: { ...old.sub, options: { applicationServerKey: null } } });
    await subscribeOgsPush(opts, f.e);
    expect(f.log).toContain("subscribe:true:65");
  });

  it("permission denied or dismissed: denied, nothing registered", async () => {
    for (const answer of ["denied", "default"] as const) {
      const f = env({ permission: async () => answer });
      await expect(subscribeOgsPush(opts, f.e)).resolves.toEqual({ status: "denied" });
      expect(f.log).toEqual([]);
    }
  });

  it("a Safari tab on iOS: unsupported, add to Home Screen", async () => {
    const f = env({ pushSupported: false, isIosBrowserTab: true });
    await expect(subscribeOgsPush(opts, f.e)).resolves.toEqual({
      status: "unsupported",
      reason: "add-to-home-screen",
    });
  });

  it("a browser with no push or no service worker: unsupported", async () => {
    await expect(subscribeOgsPush(opts, env({ pushSupported: false }).e)).resolves.toEqual({
      status: "unsupported",
      reason: "no-push",
    });
    await expect(subscribeOgsPush(opts, env({ serviceWorker: undefined }).e)).resolves.toEqual({
      status: "unsupported",
      reason: "no-push",
    });
  });

  it("OGS can't do web push right now (no key, an error, a bad answer): unavailable", async () => {
    const down = env({ fetch: async () => new Response("{}", { status: 503 }) });
    await expect(subscribeOgsPush(opts, down.e)).resolves.toEqual({
      status: "unsupported",
      reason: "unavailable",
    });
    const offline = env({
      fetch: async () => {
        throw new Error("offline");
      },
    });
    await expect(subscribeOgsPush(opts, offline.e)).resolves.toEqual({
      status: "unsupported",
      reason: "unavailable",
    });
    const weird = env({ answer: { status: "granted" } });
    await expect(subscribeOgsPush(opts, weird.e)).resolves.toEqual({
      status: "unsupported",
      reason: "unavailable",
    });
  });

  it("defaults to the production OGS API", async () => {
    const f = env();
    await subscribeOgsPush({ appId: "codebreakers" }, f.e);
    expect(f.log).toContain("GET https://api.opengame.org/api/v1/games/codebreakers/push-key");
  });
});
