import { createMockBridge } from "@open-game-system/app-bridge-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOgsNotifications,
  type NotificationsStores,
  type ServiceWorkerLike,
} from "./notifications";

const handle = "ph_abcdefghijklmnop";
const ready = { answer: null, last: null };
const push = (seq: number, title = "Your clue") => ({
  seq,
  notification: { title, body: "Moon is up.", url: "https://cb.example/" },
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("requestOgsNotifications", () => {
  it("asks the app with an id and resolves with the app's answer for that id", async () => {
    const bridge = createMockBridge<NotificationsStores>({ initialState: { notifications: ready } });
    const n = createOgsNotifications({ bridge, newId: () => "r1" });
    const answer = n.request();
    expect(bridge.getHistory("notifications")).toEqual([{ type: "REQUEST", id: "r1" }]);
    bridge.setState("notifications", { answer: { id: "r1", result: { status: "granted", handle } }, last: null });
    await expect(answer).resolves.toEqual({ status: "granted", handle });
  });

  it("passes a handle to join", async () => {
    const bridge = createMockBridge<NotificationsStores>({ initialState: { notifications: ready } });
    const n = createOgsNotifications({ bridge, newId: () => "r2" });
    void n.request({ handle });
    expect(bridge.getHistory("notifications")).toEqual([{ type: "REQUEST", id: "r2", handle }]);
  });

  it("ignores an earlier answer for another request", async () => {
    const bridge = createMockBridge<NotificationsStores>({
      initialState: { notifications: { answer: { id: "old", result: { status: "denied" } }, last: null } },
    });
    const n = createOgsNotifications({ bridge, newId: () => "new" });
    let settled: unknown = "pending";
    void n.request().then((r) => {
      settled = r;
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toBe("pending");
    bridge.setState("notifications", { answer: { id: "new", result: { status: "denied" } }, last: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toEqual({ status: "denied" });
  });

  it("waits for the store when the app hasn't sent it yet", async () => {
    const bridge = createMockBridge<NotificationsStores>();
    const n = createOgsNotifications({ bridge, newId: () => "r3" });
    const answer = n.request();
    await vi.advanceTimersByTimeAsync(100);
    bridge.setState("notifications", ready);
    expect(bridge.getHistory("notifications")).toEqual([{ type: "REQUEST", id: "r3" }]);
    bridge.setState("notifications", { answer: { id: "r3", result: { status: "denied" } }, last: null });
    await expect(answer).resolves.toEqual({ status: "denied" });
  });

  it("is null when the store never comes (300 ms)", async () => {
    const bridge = createMockBridge<NotificationsStores>();
    const answer = createOgsNotifications({ bridge }).request();
    await vi.advanceTimersByTimeAsync(300);
    await expect(answer).resolves.toBeNull();
  });

  it("is null at once outside the OGS app", async () => {
    const bridge = createMockBridge<NotificationsStores>({ isSupported: false });
    await expect(createOgsNotifications({ bridge }).request()).resolves.toBeNull();
  });

  it("drops a malformed answer and keeps waiting", async () => {
    const bridge = createMockBridge<NotificationsStores>({ initialState: { notifications: ready } });
    const n = createOgsNotifications({ bridge, newId: () => "r4" });
    let settled: unknown = "pending";
    void n.request().then((r) => {
      settled = r;
    });
    // @ts-expect-error: the app sent something that is not a state
    bridge.setState("notifications", { answer: { id: "r4", result: { status: "maybe" } } });
    await vi.advanceTimersByTimeAsync(10);
    expect(settled).toBe("pending");
  });
});

describe("onOgsNotification in the OGS app", () => {
  it("says LISTENING on and calls the handler for each new push", () => {
    const bridge = createMockBridge<NotificationsStores>({ initialState: { notifications: ready } });
    const seen: string[] = [];
    const off = createOgsNotifications({ bridge }).listen((n) => seen.push(n.title));
    expect(bridge.getHistory("notifications")).toEqual([{ type: "LISTENING", on: true }]);
    bridge.setState("notifications", { answer: null, last: push(1, "one") });
    bridge.setState("notifications", { answer: null, last: push(1, "one") });
    bridge.setState("notifications", { answer: null, last: push(2, "two") });
    expect(seen).toEqual(["one", "two"]);
    off();
    expect(bridge.getHistory("notifications")).toEqual([
      { type: "LISTENING", on: true },
      { type: "LISTENING", on: false },
    ]);
    bridge.setState("notifications", { answer: null, last: push(3, "three") });
    expect(seen).toEqual(["one", "two"]);
  });

  it("never replays the push that was already there when it started listening", () => {
    const bridge = createMockBridge<NotificationsStores>({ initialState: { notifications: { answer: null, last: push(7) } } });
    const seen: string[] = [];
    createOgsNotifications({ bridge }).listen((n) => seen.push(n.title));
    expect(seen).toEqual([]);
  });

  it("starts listening when the store arrives late", () => {
    const bridge = createMockBridge<NotificationsStores>();
    const seen: string[] = [];
    createOgsNotifications({ bridge }).listen((n) => seen.push(n.title));
    bridge.setState("notifications", ready);
    expect(bridge.getHistory("notifications")).toEqual([{ type: "LISTENING", on: true }]);
    bridge.setState("notifications", { answer: null, last: push(1, "late") });
    expect(seen).toEqual(["late"]);
  });

  it("several handlers each hear it; LISTENING off only when the last one stops", () => {
    const bridge = createMockBridge<NotificationsStores>({ initialState: { notifications: ready } });
    const n = createOgsNotifications({ bridge });
    const a: string[] = [];
    const b: string[] = [];
    const offA = n.listen((x) => a.push(x.title));
    const offB = n.listen((x) => b.push(x.title));
    bridge.setState("notifications", { answer: null, last: push(1, "x") });
    expect([a, b]).toEqual([["x"], ["x"]]);
    offA();
    expect(bridge.getHistory("notifications")).toEqual([{ type: "LISTENING", on: true }]);
    offB();
    expect(bridge.getHistory("notifications")).toEqual([
      { type: "LISTENING", on: true },
      { type: "LISTENING", on: false },
    ]);
  });
});

describe("onOgsNotification in the game's PWA", () => {
  const fakeWorker = () => {
    let listener: ((ev: { data: unknown; ports: readonly { postMessage(m: unknown): void }[] }) => void) | null = null;
    const sw: ServiceWorkerLike = {
      addEventListener: (_t, l) => {
        listener = l;
      },
      removeEventListener: (type) => {
        if (type === "message") listener = null;
      },
    };
    const send = (data: unknown) => {
      const replies: unknown[] = [];
      listener?.({ data, ports: [{ postMessage: (m) => replies.push(m) }] });
      return replies;
    };
    return { sw, send, attached: () => listener !== null };
  };

  it("hears the service worker's push and answers that it handled it", () => {
    const bridge = createMockBridge<NotificationsStores>({ isSupported: false });
    const w = fakeWorker();
    const seen: string[] = [];
    const off = createOgsNotifications({ bridge, serviceWorker: w.sw }).listen((n) => seen.push(n.title));
    const replies = w.send({ type: "ogs:notification", notification: push(1, "web").notification });
    expect(seen).toEqual(["web"]);
    expect(replies).toEqual([{ handled: true }]);
    off();
    expect(w.attached()).toBe(false);
  });

  it("ignores other worker messages", () => {
    const bridge = createMockBridge<NotificationsStores>({ isSupported: false });
    const w = fakeWorker();
    const seen: string[] = [];
    createOgsNotifications({ bridge, serviceWorker: w.sw }).listen((n) => seen.push(n.title));
    expect(w.send({ type: "something-else" })).toEqual([]);
    expect(seen).toEqual([]);
  });

  it("in a plain browser with no worker, listening does nothing", () => {
    const bridge = createMockBridge<NotificationsStores>({ isSupported: false });
    const off = createOgsNotifications({ bridge }).listen(() => {});
    expect(bridge.getHistory("notifications")).toEqual([]);
    off();
  });
});
