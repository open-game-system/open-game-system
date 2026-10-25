import { z } from "zod";
import type { CastHost } from "./receiver";

/** The phone and the receiver talk on this namespace (packages/shell/src/cast-view.ts). */
export const VIEW_NAMESPACE = "urn:x-cast:org.opengame.view";

type CafOptions = {
  disableIdleTimeout?: boolean;
  skipPlayersLoad?: boolean;
  customNamespaces?: Record<string, string>;
};
interface CafContext {
  addCustomMessageListener(ns: string, h: (e: { data: unknown; senderId: string }) => void): void;
  sendCustomMessage(ns: string, senderId: string | undefined, data: unknown): void;
  addEventListener(type: string, h: (e: { senderId: string }) => void): void;
  getSenders(): unknown[];
  start(options: CafOptions): void;
  stop(): void;
  canDisplayType(
    mime: string,
    codecs?: string,
    width?: number,
    height?: number,
    framerate?: number,
  ): boolean;
}
/** The slice of CAF's `cast` global (cast_receiver_framework.js v3) this receiver uses. */
export interface CafNamespace {
  framework: {
    CastReceiverContext: { getInstance(): CafContext };
    CastReceiverOptions: new () => CafOptions;
    system: {
      EventType: { SENDER_CONNECTED: string; SENDER_DISCONNECTED: string };
      MessageType: { JSON: string };
    };
  };
}

/** A host that can also say whether the screen takes 4K (CAF only). */
export type ReceiverHost = CastHost & { uhd(): boolean | undefined };

const parseData = (data: unknown): unknown => {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

/** Cast messaging on a Cast device, through CAF. */
export function cafHost(caf: CafNamespace): ReceiverHost {
  const fw = caf.framework;
  const ctx = fw.CastReceiverContext.getInstance();
  const send = (to: string | undefined, m: object) => {
    try {
      ctx.sendCustomMessage(VIEW_NAMESPACE, to, m);
    } catch {
      /* no senders yet */
    }
  };
  return {
    onMessage(handler) {
      ctx.addCustomMessageListener(VIEW_NAMESPACE, (e) =>
        handler(parseData(e.data), (m) => send(e.senderId, m)),
      );
    },
    onSenders(handler) {
      const count = () => ctx.getSenders().length;
      ctx.addEventListener(fw.system.EventType.SENDER_CONNECTED, () =>
        handler("connected", count()),
      );
      ctx.addEventListener(fw.system.EventType.SENDER_DISCONNECTED, () =>
        handler("disconnected", count()),
      );
    },
    broadcast: (m) => send(undefined, m),
    start() {
      const options = new fw.CastReceiverOptions();
      // The page draws the launcher, not Cast media: Cast must not close it as idle, and its media
      // player (a few MB and a decoder) is never needed on these small devices.
      options.disableIdleTimeout = true;
      options.skipPlayersLoad = true;
      options.customNamespaces = { [VIEW_NAMESPACE]: fw.system.MessageType.JSON };
      ctx.start(options);
    },
    stop: () => ctx.stop(),
    uhd() {
      try {
        return ctx.canDisplayType("video/mp4", "hev1.1.6.L150.B0", 3840, 2160, 30);
      } catch {
        return undefined;
      }
    },
  };
}

/**
 * Desktop testing without a Cast device (`?signal=test`): a harness relays sender messages through
 * window.__ogsSignalIn (to this page) and reads replies from window.__ogsSignalOut. One sender,
 * connected from the start.
 */
export function relayHost(win: {
  __ogsSignalIn?: (data: unknown) => void;
  __ogsSignalOut?: (data: unknown) => void;
}): ReceiverHost {
  let onMessage: ((data: unknown, reply: (m: object) => void) => void) | null = null;
  let onSenders: ((s: "connected" | "disconnected", n: number) => void) | null = null;
  const out = (m: object) => win.__ogsSignalOut?.(m);
  return {
    onMessage: (h) => {
      onMessage = h;
    },
    onSenders: (h) => {
      onSenders = h;
    },
    broadcast: out,
    start() {
      win.__ogsSignalIn = (data) => onMessage?.(parseData(data), out);
      onSenders?.("connected", 1);
    },
    stop: () => {},
    uhd: () => undefined,
  };
}

const Relayed = z.discriminatedUnion("ogsRx", [
  z.object({ ogsRx: z.literal("in"), senderId: z.string(), data: z.unknown() }),
]);

/** The window slice parentHost needs (a framed receiver page). */
export interface FramedWindow {
  parent: { postMessage(message: unknown, targetOrigin: string): void };
  location: { ancestorOrigins?: ArrayLike<string>; search: string };
  addEventListener(
    type: "message",
    handler: (e: { data: unknown; origin: string; source: unknown }) => void,
  ): void;
}

/**
 * Framed by the OGS Cast receiver page (apps/web/public/receiver.html, the URL registered for the
 * Cast app), which owns CAF and the laptop path: it relays the view namespace to this page as
 * `{ogsRx: "in", senderId, data}`, sends what this page posts back (`{ogsRx: "out", to, data}`) to
 * the senders, and closes the Cast app on `{ogsRx: "stop"}`. `uhd=1|0` in this page's URL is CAF's
 * 4K answer. Only messages from the parent window, at the parent's origin, count.
 */
export function parentHost(win: FramedWindow): ReceiverHost {
  const origin = win.location.ancestorOrigins?.[0] ?? "*";
  const uhd = new URLSearchParams(win.location.search).get("uhd");
  let onMessage: ((data: unknown, reply: (m: object) => void) => void) | null = null;
  let onSenders: ((s: "connected" | "disconnected", n: number) => void) | null = null;
  const post = (m: object) => win.parent.postMessage(m, origin);
  return {
    onMessage: (h) => {
      onMessage = h;
    },
    onSenders: (h) => {
      onSenders = h;
    },
    broadcast: (data) => post({ ogsRx: "out", to: null, data }),
    start() {
      win.addEventListener("message", (e) => {
        if (e.source !== win.parent || (origin !== "*" && e.origin !== origin)) return;
        const r = Relayed.safeParse(e.data);
        if (!r.success) return;
        const { senderId } = r.data;
        onMessage?.(parseData(r.data.data), (data) => post({ ogsRx: "out", to: senderId, data }));
      });
      post({ ogsRx: "ready" });
      onSenders?.("connected", 1);
    },
    stop: () => post({ ogsRx: "stop" }),
    uhd: () => (uhd === "1" ? true : uhd === "0" ? false : undefined),
  };
}
