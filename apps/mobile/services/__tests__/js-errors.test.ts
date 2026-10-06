import { type ClientLog, type ClientLogContext, createClientLog, STORAGE_KEY } from "../client-log";
import { captureJsErrors, type GlobalHandler } from "../js-errors";

/**
 * JS errors the app didn't catch (the global handler, unhandled promise rejections, the error
 * boundary) become client-log error events with an error type and stack, so the API logs them
 * with `errorType` and sre-agent can group them. A crash loop doesn't flood the log.
 */
type Sent = { context: ClientLogContext; events: Record<string, unknown>[] };

function setup() {
  const sent: Sent[] = [];
  const store = new Map<string, string>();
  let clock = 1_000;
  const log = createClientLog({
    send: async (batch) => {
      sent.push(JSON.parse(JSON.stringify(batch)));
      return true;
    },
    context: () => ({ app: "mobile", build: "7" }),
    now: () => clock,
    schedule: () => () => {},
    storage: {
      getItem: async (k) => store.get(k) ?? null,
      setItem: async (k, v) => {
        store.set(k, v);
      },
      removeItem: async (k) => {
        store.delete(k);
      },
    },
  });
  let handler: GlobalHandler = () => {};
  const previous: [unknown, boolean | undefined][] = [];
  handler = (error, isFatal) => previous.push([error, isFatal]);
  const errorUtils = {
    getGlobalHandler: () => handler,
    setGlobalHandler: (h: GlobalHandler) => {
      handler = h;
    },
  };
  let onUnhandled: ((id: number, reason: unknown) => void) | null = null;
  const tracker = (o: { onUnhandled: (id: number, reason: unknown) => void }) => {
    onUnhandled = o.onUnhandled;
  };
  const capture = captureJsErrors(log, { errorUtils, trackRejections: tracker, now: () => clock });
  return {
    log,
    sent,
    store,
    previous,
    capture,
    events: () => sent.flatMap((b) => b.events),
    throwGlobal: (error: unknown, fatal?: boolean) => handler(error, fatal),
    reject: (reason: unknown) => onUnhandled?.(1, reason),
    tick: (ms: number) => {
      clock += ms;
    },
  };
}

const flushed = () => new Promise((r) => setTimeout(r, 0));

describe("captureJsErrors", () => {
  it("a thrown error reaches the global handler: one error event with type, message and stack, sent now, then the previous handler", async () => {
    const t = setup();
    const err = new TypeError("undefined is not an object");
    t.throwGlobal(err, true);
    await flushed();
    expect(t.events()).toHaveLength(1);
    expect(t.events()[0]).toMatchObject({
      name: "app.js_error",
      level: "error",
      error: "undefined is not an object",
      errorType: "TypeError",
      data: { fatal: true },
    });
    expect(String(t.events()[0].errorStack)).toContain("TypeError");
    // RN's own handler still runs (the red box in dev, the crash in release).
    expect(t.previous).toEqual([[err, true]]);
  });

  it("an unhandled promise rejection is an error event (a non-Error reason gets a stable type)", async () => {
    const t = setup();
    t.reject(new RangeError("too far"));
    t.reject("just a string");
    await t.log.flush();
    expect(t.events().map((e) => [e.name, e.errorType, e.error])).toEqual([
      ["app.unhandled_rejection", "RangeError", "too far"],
      ["app.unhandled_rejection", "UnhandledRejection", "just a string"],
    ]);
  });

  it("the error boundary reports a render error with its boundary name", async () => {
    const t = setup();
    t.capture.boundary(new Error("render failed"), "root");
    await t.log.flush();
    expect(t.events()[0]).toMatchObject({
      name: "app.render_error",
      errorType: "Error",
      error: "render failed",
      data: { boundary: "root" },
    });
  });

  it("a crash loop doesn't flood: 3 of one error per launch, 20 errors a minute", async () => {
    const t = setup();
    for (let i = 0; i < 10; i++) t.throwGlobal(new Error("same every frame"));
    await t.log.flush();
    expect(t.events()).toHaveLength(3);
    for (let i = 0; i < 40; i++) t.throwGlobal(new Error(`distinct ${i}`));
    await t.log.flush();
    expect(t.events()).toHaveLength(20);
    t.tick(60_001);
    t.throwGlobal(new Error("a minute later"));
    await t.log.flush();
    expect(t.events()).toHaveLength(21);
    // Every throw still reaches RN's handler.
    expect(t.previous).toHaveLength(51);
  });

  it("never logs a token from the message or stack", async () => {
    const t = setup();
    const err = new Error("load failed http://tv/?token=abc.def.ghi");
    err.stack = "Error: load failed http://tv/?token=abc.def.ghi\n    at fn (app.js:1:2)";
    t.throwGlobal(err);
    await flushed();
    const text = JSON.stringify(t.events());
    expect(text).not.toContain("abc.def.ghi");
  });

  it("an event kept for the next launch keeps its error type and stack", async () => {
    let saved = "";
    const offline: ClientLog = createClientLog({
      send: async () => false,
      context: () => ({ app: "mobile" }),
      now: () => 1,
      schedule: () => () => {},
      storage: {
        getItem: async () => null,
        setItem: async (_k, v) => {
          saved = v;
        },
        removeItem: async () => {},
      },
    });
    offline.event("app.js_error", {
      error: new Error("x"),
      errorType: "TypeError",
      errorStack: "TypeError: x",
    });
    await offline.background();
    const sent: Sent[] = [];
    const next = createClientLog({
      send: async (b) => {
        sent.push(JSON.parse(JSON.stringify(b)));
        return true;
      },
      context: () => ({ app: "mobile" }),
      now: () => 2,
      schedule: () => () => {},
      storage: {
        getItem: async (k) => (k === STORAGE_KEY ? saved : null),
        setItem: async () => {},
        removeItem: async () => {},
      },
    });
    await next.restore();
    await next.flush();
    expect(sent[0].events[0]).toMatchObject({ errorType: "TypeError", errorStack: "TypeError: x" });
  });
});
