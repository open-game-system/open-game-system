import type { NativeLogEvent, NativeLogSource } from "../airplay-display";
import type { ClientLog, EventFields } from "../client-log";
import { forwardNativeLog } from "../native-log-forward";

const ev = (
  seq: number,
  type = `e${seq}`,
  level: NativeLogEvent["level"] = "info",
): NativeLogEvent => ({
  seq,
  at: 1000 + seq,
  type,
  level,
  data: { n: seq },
});

function recorder() {
  const events: { name: string; fields: EventFields | undefined }[] = [];
  const log: ClientLog = {
    event: (name, fields) => void events.push({ name, fields }),
    flush: async () => {},
    background: async () => {},
    restore: async () => {},
  };
  return { log, names: () => events.map((e) => e.name), events };
}

function source(ring: NativeLogEvent[]) {
  let live: ((e: NativeLogEvent) => void) | null = null;
  let resolveRing: (r: NativeLogEvent[]) => void = () => {};
  const src: NativeLogSource = {
    available: true,
    recentLog: jest.fn(() => new Promise<NativeLogEvent[]>((r) => (resolveRing = r))),
    onLog: (l) => {
      live = l;
      return {
        remove: () => {
          live = null;
        },
      };
    },
    log: async () => {},
  };
  return {
    src,
    emit: (e: NativeLogEvent) => live?.(e),
    ringReady: () => resolveRing(ring),
    listening: () => live !== null,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("forwardNativeLog: native events into the app's client log", () => {
  it("sends the ring first, then live events, each once and in order (seq drops the overlap)", async () => {
    const { log, names, events } = recorder();
    const s = source([ev(1), ev(2), ev(3)]);
    const stop = forwardNativeLog(s.src, log);
    // Events while the ring is being read are held, then sent after it.
    s.emit(ev(3));
    s.emit(ev(4));
    s.ringReady();
    await flush();
    s.emit(ev(4));
    s.emit(ev(5, "audio.airplay_audio_only", "warn"));
    expect(names()).toEqual([
      "native.e1",
      "native.e2",
      "native.e3",
      "native.e4",
      "native.audio.airplay_audio_only",
    ]);
    expect(events[0]?.fields).toEqual({ level: "info", data: { n: 1, nativeAt: 1001, seq: 1 } });
    expect(events[4]?.fields?.level).toBe("warn");
    stop();
    expect(s.listening()).toBe(false);
  });

  it("an unreadable ring still forwards live events", async () => {
    const { log, names } = recorder();
    const src: NativeLogSource = {
      available: true,
      recentLog: async () => {
        throw new Error("gone");
      },
      onLog: (l) => {
        setTimeout(() => l(ev(9)), 0);
        return { remove() {} };
      },
      log: async () => {},
    };
    forwardNativeLog(src, log);
    await flush();
    await flush();
    expect(names()).toEqual(["native.e9"]);
  });

  it("does nothing without the module", () => {
    const { log, names } = recorder();
    const recentLog = jest.fn(async () => [ev(1)]);
    const stop = forwardNativeLog(
      { available: false, recentLog, onLog: () => ({ remove() {} }), log: async () => {} },
      log,
    );
    stop();
    expect(recentLog).not.toHaveBeenCalled();
    expect(names()).toEqual([]);
  });
});
