import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRxLog, DEFAULT_API } from "./rx-log";

type Sent = {
  url: string;
  body: { context: Record<string, unknown>; events: Record<string, unknown>[] };
};

function setup() {
  const sent: Sent[] = [];
  const post = vi.fn((url: string, body: string) => {
    sent.push({ url, body: JSON.parse(body) });
  });
  const log = createRxLog({ post, run: "rx-1", version: "local-1", platform: "chromecast" });
  return { log, sent, post };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe("receiver client log", () => {
  it("posts receiver.* events to the launcher's API as the receiver app, batched", async () => {
    const { log, sent } = setup();
    log.setApi("https://api.example");
    log.event("launched", { data: { tier: "lite" } });
    log.event("view.loaded", { durationMs: 1234.6 });
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("https://api.example/api/v1/client-events");
    expect(sent[0]?.body.context).toEqual({
      app: "receiver",
      version: "local-1",
      platform: "chromecast",
    });
    expect(sent[0]?.body.events).toEqual([
      {
        name: "receiver.launched",
        at: 1_000_000,
        level: "info",
        attemptId: "rx-1",
        data: { tier: "lite" },
      },
      {
        name: "receiver.view.loaded",
        at: 1_000_000,
        level: "info",
        attemptId: "rx-1",
        durationMs: 1235,
      },
    ]);
  });

  it("an error is level error with its message, and goes at once with now", () => {
    const { log, sent } = setup();
    log.setApi("https://api.example");
    log.event("error", { error: new Error("boom"), now: true });
    expect(sent[0]?.body.events[0]).toMatchObject({
      name: "receiver.error",
      level: "error",
      error: "boom",
    });
  });

  it("holds events until the API is known (the first LOAD_VIEW), then sends them there", async () => {
    const { log, sent } = setup();
    log.event("launched");
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toHaveLength(0);
    log.setApi("http://192.168.1.4:8787");
    log.flush();
    expect(sent[0]?.url).toBe("http://192.168.1.4:8787/api/v1/client-events");
  });

  it("with no sender after 15 s, sends to the production API", async () => {
    const { log, sent } = setup();
    log.event("launched");
    await vi.advanceTimersByTimeAsync(15_000);
    expect(sent[0]?.url).toBe(`${DEFAULT_API}/api/v1/client-events`);
  });

  it("joins events to the phone's cast attempt and couch session, including ones still queued", async () => {
    const { log, sent } = setup();
    log.event("launched");
    log.join({ phoneAttemptId: "cast-9", sessionId: "s1" });
    log.setApi("https://api.example");
    log.event("view.loaded");
    log.flush();
    for (const e of sent[0]?.body.events ?? [])
      expect(e).toMatchObject({ phoneAttemptId: "cast-9", sessionId: "s1" });
  });

  it("drops join ids that aren't short strings", () => {
    const { log, sent } = setup();
    log.join({ phoneAttemptId: "x".repeat(65), sessionId: 7 });
    log.setApi("https://api.example");
    log.event("launched", { now: true });
    expect(sent[0]?.body.events[0]).not.toHaveProperty("phoneAttemptId");
    expect(sent[0]?.body.events[0]).not.toHaveProperty("sessionId");
  });

  it("sends at most 50 events per batch and keeps at most the last 200", () => {
    const { log, sent } = setup();
    for (let i = 0; i < 260; i++) log.event("tick", { data: { i } });
    log.setApi("https://api.example");
    log.flush();
    expect(sent.map((s) => s.body.events.length)).toEqual([50, 50, 50, 50]);
    expect(sent[0]?.body.events[0]?.data).toEqual({ i: 60 });
  });

  it("never throws when posting fails", () => {
    const log = createRxLog({
      post: () => {
        throw new Error("offline");
      },
      run: "rx",
      version: "v",
      platform: "p",
    });
    log.setApi("https://api.example");
    expect(() => log.event("launched", { now: true })).not.toThrow();
  });

  it("the production API is opengame-api's workers.dev", () => {
    expect(DEFAULT_API).toBe("https://opengame-api.jonathanrmumm.workers.dev");
  });

  it("an API with trailing slashes is used without them", () => {
    const { log, sent } = setup();
    log.setApi("https://api.example//");
    log.event("launched", { now: true });
    expect(sent[0]?.url).toBe("https://api.example/api/v1/client-events");
  });

  it("keeps join ids of 1 to 64 characters, drops empty ones", () => {
    const { log, sent } = setup();
    log.join({ phoneAttemptId: "x".repeat(64), sessionId: "" });
    log.setApi("https://api.example");
    log.event("launched", { now: true });
    expect(sent[0]?.body.events[0]?.phoneAttemptId).toBe("x".repeat(64));
    expect(sent[0]?.body.events[0]).not.toHaveProperty("sessionId");
  });

  it("cuts an error message at 1000 characters, and logs a non-Error as text", () => {
    const { log, sent } = setup();
    log.setApi("https://api.example");
    log.event("error", { error: new Error("e".repeat(1500)), now: true });
    log.event("error", { error: "plain", now: true });
    expect(sent[0]?.body.events[0]?.error).toBe("e".repeat(1000));
    expect(sent[1]?.body.events[0]?.error).toBe("plain");
  });

  it("an empty flush posts nothing", () => {
    const { log, post } = setup();
    log.setApi("https://api.example");
    log.flush();
    expect(post).not.toHaveBeenCalled();
  });
});
