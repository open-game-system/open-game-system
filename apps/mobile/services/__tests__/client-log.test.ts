import {
  type ClientLogContext,
  clientEventsSender,
  createClientLog,
  hashId,
  newAttemptId,
} from "../client-log";

type Batch = { context: ClientLogContext; events: Record<string, unknown>[] };

function setup(opts: { ok?: () => boolean; stored?: string | null; batchSize?: number } = {}) {
  const sent: Batch[] = [];
  const store = new Map<string, string>();
  if (opts.stored) store.set("@ogs/client-log", opts.stored);
  let ctx: ClientLogContext = { app: "mobile", build: "7", version: "1.0.0", platform: "ios 18" };
  let clock = 1000;
  const timers: (() => void)[] = [];
  const log = createClientLog({
    send: async (batch) => {
      if (opts.ok && !opts.ok()) return false;
      sent.push(JSON.parse(JSON.stringify(batch)));
      return true;
    },
    context: () => ctx,
    now: () => clock,
    storage: {
      getItem: async (k) => store.get(k) ?? null,
      setItem: async (k, v) => {
        store.set(k, v);
      },
      removeItem: async (k) => {
        store.delete(k);
      },
    },
    schedule: (fn) => {
      timers.push(fn);
      return () => {};
    },
    batchSize: opts.batchSize,
  });
  return {
    log,
    sent,
    store,
    timers,
    setCtx: (c: Partial<ClientLogContext>) => {
      ctx = { ...ctx, ...c };
    },
    tick: (ms: number) => {
      clock += ms;
    },
  };
}

describe("client log: wide events to POST /api/v1/client-events", () => {
  it("batches events with their context and sends them on flush", async () => {
    const t = setup();
    t.log.event("cast.start.requested", { attemptId: "a1", data: { tv: "h:1" } });
    t.tick(5);
    t.log.event("cast.start.resolved", { attemptId: "a1", durationMs: 5, data: { ok: true } });
    await t.log.flush();
    expect(t.sent).toEqual([
      {
        context: { app: "mobile", build: "7", version: "1.0.0", platform: "ios 18" },
        events: [
          {
            name: "cast.start.requested",
            at: 1000,
            level: "info",
            attemptId: "a1",
            data: { tv: "h:1" },
          },
          {
            name: "cast.start.resolved",
            at: 1005,
            level: "info",
            attemptId: "a1",
            durationMs: 5,
            data: { ok: true },
          },
        ],
      },
    ]);
  });

  it("schedules a flush after the first event", async () => {
    const t = setup();
    t.log.event("a");
    t.log.event("b");
    expect(t.timers).toHaveLength(1);
    t.timers[0]();
    await new Promise((r) => setTimeout(r, 0));
    expect(t.sent[0].events.map((e) => e.name)).toEqual(["a", "b"]);
  });

  it("an event's context is the one when it happened (a new couch session starts a new batch)", async () => {
    const t = setup();
    t.log.event("a");
    t.setCtx({ sessionId: "s1", profileId: "p1" });
    t.log.event("b");
    await t.log.flush();
    expect(t.sent.map((b) => [b.context.sessionId, b.events.map((e) => e.name)])).toEqual([
      [undefined, ["a"]],
      ["s1", ["b"]],
    ]);
  });

  it("an error becomes its message, at level error", async () => {
    const t = setup();
    t.log.event("cast.start.rejected", { error: new Error("No device") });
    t.log.event("x", { error: "plain", level: "warn" });
    await t.log.flush();
    expect(t.sent[0].events).toEqual([
      { name: "cast.start.rejected", at: 1000, level: "error", error: "No device" },
      { name: "x", at: 1000, level: "warn", error: "plain" },
    ]);
  });

  it("never sends a token: token= values and JWTs are redacted, secret-named keys dropped", async () => {
    const t = setup();
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb20ifQ.c2lnbmF0dXJl";
    t.log.event("cast.load_view.sent", {
      data: { viewUrl: `http://tv/?api=x&token=${jwt}`, deviceToken: "secret", raw: jwt },
      error: `bad http://tv/?token=abc`,
    });
    await t.log.flush();
    const text = JSON.stringify(t.sent);
    expect(text).not.toContain(jwt);
    expect(text).not.toContain("abc");
    expect(text).not.toContain("secret");
    expect(t.sent[0].events[0]).toMatchObject({
      data: { viewUrl: "http://tv/?api=x&token=REDACTED", raw: "REDACTED" },
      error: "bad http://tv/?token=REDACTED",
    });
  });

  it("drops undefined data values and caps long strings", async () => {
    const t = setup();
    t.log.event("x", { data: { a: undefined, b: "y".repeat(5000) } });
    await t.log.flush();
    const data = t.sent[0].events[0].data as Record<string, string>;
    expect(Object.keys(data)).toEqual(["b"]);
    expect(data.b.length).toBe(1000);
  });

  it("offline: keeps events and sends them with the next flush", async () => {
    let online = false;
    const t = setup({ ok: () => online });
    t.log.event("a");
    await t.log.flush();
    expect(t.sent).toEqual([]);
    online = true;
    t.log.event("b");
    await t.log.flush();
    expect(t.sent[0].events.map((e) => e.name)).toEqual(["a", "b"]);
  });

  it("a send that throws keeps the events too", async () => {
    const sent: unknown[] = [];
    let fail = true;
    const log = createClientLog({
      send: async (b) => {
        if (fail) throw new TypeError("Network request failed");
        sent.push(b);
        return true;
      },
      context: () => ({ app: "mobile" }),
      now: () => 1,
      schedule: () => () => {},
    });
    log.event("a");
    await log.flush();
    fail = false;
    await log.flush();
    expect(sent).toHaveLength(1);
  });

  it("sends at most one batch size per request", async () => {
    const t = setup({ batchSize: 2 });
    for (const n of ["a", "b", "c"]) t.log.event(n);
    await t.log.flush();
    expect(t.sent.map((b) => b.events.length)).toEqual([2, 1]);
  });

  it("keeps at most 500 events, dropping the oldest", async () => {
    let online = false;
    const t = setup({ ok: () => online });
    for (let i = 0; i < 505; i++) t.log.event(`e${i}`);
    online = true;
    await t.log.flush();
    const names = t.sent.flatMap((b) => b.events.map((e) => e.name));
    expect(names).toHaveLength(500);
    expect(names[0]).toBe("e5");
  });

  it("on background: flushes, and keeps what it could not send for the next launch", async () => {
    let online = false;
    const t = setup({ ok: () => online });
    t.log.event("a");
    await t.log.background();
    expect(t.store.get("@ogs/client-log")).toBeDefined();

    // Next launch: restored, then sent.
    online = true;
    const next = setup({ stored: t.store.get("@ogs/client-log") });
    await next.log.restore();
    next.log.event("b");
    await next.log.flush();
    expect(next.sent.flatMap((b) => b.events.map((e) => e.name))).toEqual(["a", "b"]);
    expect(next.store.has("@ogs/client-log")).toBe(false);
  });

  it("a stored buffer that is not valid is ignored", async () => {
    const t = setup({ stored: "{nope" });
    await t.log.restore();
    await t.log.flush();
    expect(t.sent).toEqual([]);
  });

  it("only one flush runs at a time", async () => {
    let release: () => void = () => {};
    let calls = 0;
    const log = createClientLog({
      send: () => {
        calls++;
        return new Promise((r) => {
          release = () => r(true);
        });
      },
      context: () => ({ app: "mobile" }),
      now: () => 1,
      schedule: () => () => {},
    });
    log.event("a");
    const first = log.flush();
    const second = log.flush();
    release();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });
});

describe("ids", () => {
  it("hashes device ids: stable, not the id, 16 hex chars after h:", () => {
    expect(hashId("fake-bedroom")).toBe(hashId("fake-bedroom"));
    expect(hashId("fake-bedroom")).not.toBe(hashId("fake-living-room"));
    expect(hashId("fake-bedroom")).toMatch(/^h:[0-9a-f]{16}$/);
  });

  it("attempt ids are unique and short", () => {
    const a = newAttemptId();
    expect(a).not.toBe(newAttemptId());
    expect(a.length).toBeLessThanOrEqual(64);
  });
});

describe("sending to the API", () => {
  const batch = {
    context: { app: "mobile" as const },
    events: [{ name: "a", at: 1, level: "info" as const }],
  };
  function sender(status: number, token: string | null = "tok") {
    const calls: { url: string; init?: RequestInit }[] = [];
    const send = clientEventsSender({
      baseUrl: "https://api.test",
      fetch: async (url, init) => {
        calls.push({ url, init });
        return new Response("{}", { status });
      },
      auth: () => (token ? { token } : null),
    });
    return { send, calls };
  }

  it("POSTs the batch with the profile token", async () => {
    const s = sender(202);
    await expect(s.send(batch)).resolves.toBe(true);
    expect(s.calls[0].url).toBe("https://api.test/api/v1/client-events");
    expect(s.calls[0].init?.method).toBe("POST");
    expect(s.calls[0].init?.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer tok",
    });
    expect(JSON.parse(String(s.calls[0].init?.body))).toEqual(batch);
  });

  it("without a profile yet, keeps the events (nothing sent)", async () => {
    const s = sender(202, null);
    await expect(s.send(batch)).resolves.toBe(false);
    expect(s.calls).toEqual([]);
  });

  it("keeps the events on 401, 429 and 5xx; drops a batch the API will never take (400, 413)", async () => {
    for (const [status, done] of [
      [401, false],
      [429, false],
      [503, false],
      [400, true],
      [413, true],
    ] as const)
      await expect(sender(status).send(batch)).resolves.toBe(done);
  });
});
