import { describe, expect, it, vi } from "vitest";
import { type CafNamespace, cafHost, parentHost, relayHost, VIEW_NAMESPACE } from "./cast-host";

/** A stand-in for CAF's cast.framework: records what the host does with it. */
function fakeCaf(opts: { uhd?: boolean } = {}) {
  const listeners = new Map<string, ((e: { senderId: string }) => void)[]>();
  let custom: ((e: { data: unknown; senderId: string }) => void) | null = null;
  const sent: { ns: string; to: string | undefined; data: unknown }[] = [];
  let senders = 0;
  const started: Record<string, unknown>[] = [];
  const ctx = {
    addCustomMessageListener: (ns: string, h: (e: { data: unknown; senderId: string }) => void) => {
      expect(ns).toBe(VIEW_NAMESPACE);
      custom = h;
    },
    sendCustomMessage: vi.fn((ns: string, to: string | undefined, data: unknown) => {
      sent.push({ ns, to, data });
    }),
    addEventListener: (type: string, h: (e: { senderId: string }) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), h]);
    },
    getSenders: () => Array.from({ length: senders }, () => ({})),
    start: vi.fn((o: Record<string, unknown>) => started.push({ ...o })),
    stop: vi.fn(),
    canDisplayType: vi.fn((_m: string, _c: string, w: number) =>
      w >= 3840 ? (opts.uhd ?? false) : true,
    ),
  };
  class CastReceiverOptions {}
  const caf: CafNamespace = {
    framework: {
      CastReceiverContext: { getInstance: () => ctx },
      CastReceiverOptions,
      system: {
        EventType: {
          SENDER_CONNECTED: "senderconnected",
          SENDER_DISCONNECTED: "senderdisconnected",
        },
        MessageType: { JSON: "JSON" },
      },
    },
  };
  return {
    caf,
    ctx,
    sent,
    started,
    message: (data: unknown, senderId = "s-1") => custom?.({ data, senderId }),
    connect: (n: number) => {
      senders = n;
      for (const h of listeners.get("senderconnected") ?? []) h({ senderId: "s-1" });
    },
    disconnect: (n: number) => {
      senders = n;
      for (const h of listeners.get("senderdisconnected") ?? []) h({ senderId: "s-1" });
    },
  };
}

describe("the CAF host (a real Cast device)", () => {
  it("starts CAF with the view namespace as JSON, no idle timeout and no media player", () => {
    const f = fakeCaf();
    cafHost(f.caf).start();
    expect(f.started).toEqual([
      {
        disableIdleTimeout: true,
        skipPlayersLoad: true,
        customNamespaces: { [VIEW_NAMESPACE]: "JSON" },
      },
    ]);
  });

  it("hands sender messages over, parsing JSON strings, and replies to that sender only", () => {
    const f = fakeCaf();
    const host = cafHost(f.caf);
    const got: unknown[] = [];
    host.onMessage((data, reply) => {
      got.push(data);
      reply({ type: "STATE" });
    });
    host.start();
    f.message({ type: "GET_STATE" }, "phone-1");
    f.message('{"type":"LOAD_VIEW","viewUrl":"https://x"}', "phone-2");
    f.message("{not json", "phone-3");
    expect(got).toEqual([
      { type: "GET_STATE" },
      { type: "LOAD_VIEW", viewUrl: "https://x" },
      "{not json",
    ]);
    expect(f.sent.map((s) => s.to)).toEqual(["phone-1", "phone-2", "phone-3"]);
  });

  it("broadcasts to every sender, and never throws when there is none", () => {
    const f = fakeCaf();
    const host = cafHost(f.caf);
    host.start();
    host.broadcast({ type: "REQUEST_VIEW" });
    expect(f.sent).toEqual([{ ns: VIEW_NAMESPACE, to: undefined, data: { type: "REQUEST_VIEW" } }]);
    f.ctx.sendCustomMessage.mockImplementation(() => {
      throw new Error("no senders");
    });
    expect(() => host.broadcast({ type: "REQUEST_VIEW" })).not.toThrow();
  });

  it("reports senders connecting and leaving with how many remain", () => {
    const f = fakeCaf();
    const host = cafHost(f.caf);
    const seen: [string, number][] = [];
    host.onSenders((s, n) => seen.push([s, n]));
    host.start();
    f.connect(1);
    f.connect(2);
    f.disconnect(1);
    expect(seen).toEqual([
      ["connected", 1],
      ["connected", 2],
      ["disconnected", 1],
    ]);
  });

  it("stop closes the Cast app", () => {
    const f = fakeCaf();
    const host = cafHost(f.caf);
    host.start();
    host.stop();
    expect(f.ctx.stop).toHaveBeenCalled();
  });

  it("the view namespace is the one the phone opens", () => {
    expect(VIEW_NAMESPACE).toBe("urn:x-cast:org.opengame.view");
  });

  it("asks CAF about 4K HEVC at 30 fps, and says nothing when CAF can't answer", () => {
    const f = fakeCaf({ uhd: true });
    const host = cafHost(f.caf);
    host.uhd();
    expect(f.ctx.canDisplayType).toHaveBeenCalledWith(
      "video/mp4",
      "hev1.1.6.L150.B0",
      3840,
      2160,
      30,
    );
    f.ctx.canDisplayType.mockImplementation(() => {
      throw new Error("not ready");
    });
    expect(host.uhd()).toBeUndefined();
  });

  it("says whether the device can display 4K (a Chromecast Ultra)", () => {
    expect(cafHost(fakeCaf({ uhd: true }).caf).uhd()).toBe(true);
    expect(cafHost(fakeCaf({ uhd: false }).caf).uhd()).toBe(false);
  });
});

describe("the relay host (a desktop browser test: ?signal=test)", () => {
  it("takes messages through window.__ogsSignalIn and answers through window.__ogsSignalOut", () => {
    const win: { __ogsSignalIn?: (d: unknown) => void; __ogsSignalOut?: (d: unknown) => void } = {};
    const out: unknown[] = [];
    win.__ogsSignalOut = (d) => out.push(d);
    const host = relayHost(win);
    host.onMessage((data, reply) => reply({ echo: data }));
    const senders: [string, number][] = [];
    host.onSenders((s, n) => senders.push([s, n]));
    host.start();
    expect(senders).toEqual([["connected", 1]]);
    win.__ogsSignalIn?.('{"type":"GET_STATE"}');
    host.broadcast({ type: "REQUEST_VIEW" });
    expect(out).toEqual([{ echo: { type: "GET_STATE" } }, { type: "REQUEST_VIEW" }]);
    expect(host.uhd()).toBeUndefined();
  });
});

describe("the parent host (framed by the OGS Cast receiver page, which owns CAF)", () => {
  function framed(
    uhd: string | null = null,
    ancestors: string[] | null = ["https://opengame.org"],
  ) {
    const parent = {
      posted: [] as { m: unknown; origin: string }[],
      postMessage(m: unknown, origin: string) {
        this.posted.push({ m, origin });
      },
    };
    let listener: ((e: { data: unknown; origin: string; source: unknown }) => void) | null = null;
    const win = {
      parent,
      location: {
        ...(ancestors ? { ancestorOrigins: ancestors } : {}),
        search: uhd ? `?host=parent&uhd=${uhd}` : "?host=parent",
      },
      addEventListener: (t: "message", h: typeof listener) => {
        if (t === "message") listener = h;
      },
    };
    const host = parentHost(win);
    return {
      host,
      parent,
      deliver: (data: unknown, origin = "https://opengame.org", source: unknown = parent) =>
        listener?.({ data, origin, source }),
    };
  }

  it("says ready to its parent on start, with one sender (the parent's phones)", () => {
    const f = framed();
    const senders: [string, number][] = [];
    f.host.onSenders((s, n) => senders.push([s, n]));
    f.host.start();
    expect(f.parent.posted).toEqual([{ m: { ogsRx: "ready" }, origin: "https://opengame.org" }]);
    expect(senders).toEqual([["connected", 1]]);
  });

  it("takes sender messages the parent relays, and replies to that sender through the parent", () => {
    const f = framed();
    f.host.onMessage((data, reply) => reply({ type: "STATE", got: data }));
    f.host.start();
    f.deliver({ ogsRx: "in", senderId: "phone-1", data: { type: "GET_STATE" } });
    expect(f.parent.posted.at(-1)).toEqual({
      m: { ogsRx: "out", to: "phone-1", data: { type: "STATE", got: { type: "GET_STATE" } } },
      origin: "https://opengame.org",
    });
  });

  it("ignores messages from anything but its parent, or in another shape", () => {
    const f = framed();
    const got: unknown[] = [];
    f.host.onMessage((d) => got.push(d));
    f.host.start();
    f.deliver({ ogsRx: "in", senderId: "x", data: { type: "GET_STATE" } }, "https://evil.example");
    f.deliver(
      { ogsRx: "in", senderId: "x", data: { type: "GET_STATE" } },
      "https://opengame.org",
      {},
    );
    f.deliver({ type: "GET_STATE" });
    expect(got).toEqual([]);
  });

  it("ignores relayed messages that aren't 'in' with a sender id", () => {
    const f = framed();
    const got: unknown[] = [];
    f.host.onMessage((d) => got.push(d));
    f.host.start();
    f.deliver({ ogsRx: "out", senderId: "x", data: { type: "GET_STATE" } });
    f.deliver({ ogsRx: "in", senderId: 7, data: { type: "GET_STATE" } });
    expect(got).toEqual([]);
  });

  it("without ancestorOrigins (not Chrome) it posts to any origin and takes its parent's messages", () => {
    const f = framed(null, null);
    const got: unknown[] = [];
    f.host.onMessage((d) => got.push(d));
    f.host.start();
    expect(f.parent.posted[0]?.origin).toBe("*");
    f.deliver(
      { ogsRx: "in", senderId: "p", data: { type: "GET_STATE" } },
      "https://anything.example",
    );
    expect(got).toEqual([{ type: "GET_STATE" }]);
  });

  it("broadcasts and stops through the parent (the parent closes the Cast app)", () => {
    const f = framed();
    f.host.start();
    f.host.broadcast({ type: "REQUEST_VIEW" });
    f.host.stop();
    expect(f.parent.posted.slice(1).map((p) => p.m)).toEqual([
      { ogsRx: "out", to: null, data: { type: "REQUEST_VIEW" } },
      { ogsRx: "stop" },
    ]);
  });

  it("knows 4K from the parent's uhd= (CAF's canDisplayType is the parent's)", () => {
    expect(framed("1").host.uhd()).toBe(true);
    expect(framed("0").host.uhd()).toBe(false);
    expect(framed().host.uhd()).toBeUndefined();
  });
});
