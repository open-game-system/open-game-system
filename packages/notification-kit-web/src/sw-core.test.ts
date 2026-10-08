import { describe, expect, it } from "vitest";
import { type ClientLike, handleClick, handlePush, PAGE_ANSWER_MS, pushText } from "./sw-core";

const payload = {
  title: "Clue: RIVER 2",
  body: "Your guess.",
  url: "https://cb.example/room/KQTP",
  whenOpen: "deliver",
  tag: "cb-KQTP",
};

function windowClient(over: Partial<ClientLike> & { answer?: unknown } = {}) {
  const posted: unknown[] = [];
  const client: ClientLike = {
    url: "https://cb.example/room/KQTP",
    focused: true,
    postMessage(message, ports) {
      posted.push(message);
      if (over.answer !== undefined) ports[0]?.postMessage(over.answer);
    },
    focus: async () => client,
    navigate: async () => client,
    ...over,
  };
  return { client, posted };
}

function deps(clients: ClientLike[]) {
  const shown: { title: string; options: unknown }[] = [];
  return {
    shown,
    deps: {
      clients: async () => clients,
      show: async (title: string, options: unknown) => void shown.push({ title, options }),
      wait: (ms: number) => new Promise<void>((r) => setTimeout(r, Math.min(ms, 5))),
    },
  };
}

describe("a push arriving at the game's service worker", () => {
  it("no window open: shows the notification with its tag and url", async () => {
    const d = deps([]);
    await handlePush(JSON.stringify(payload), d.deps);
    expect(d.shown).toEqual([
      {
        title: "Clue: RIVER 2",
        options: {
          body: "Your guess.",
          tag: "cb-KQTP",
          data: { url: "https://cb.example/room/KQTP" },
        },
      },
    ]);
  });

  it("a focused window that handles it: no notification (the page showed its own hint)", async () => {
    const w = windowClient({ answer: { handled: true } });
    const d = deps([w.client]);
    await handlePush(JSON.stringify(payload), d.deps);
    expect(w.posted).toEqual([
      {
        type: "ogs:notification",
        notification: {
          title: "Clue: RIVER 2",
          body: "Your guess.",
          url: "https://cb.example/room/KQTP",
          tag: "cb-KQTP",
        },
      },
    ]);
    expect(d.shown).toEqual([]);
  });

  it("a focused window with no handler (no answer in time): shows it", async () => {
    const w = windowClient();
    const d = deps([w.client]);
    await handlePush(JSON.stringify(payload), d.deps);
    expect(w.posted).toHaveLength(1);
    expect(d.shown).toHaveLength(1);
  });

  it("an answer that isn't 'handled' shows it", async () => {
    const w = windowClient({ answer: { handled: false } });
    const d = deps([w.client]);
    await handlePush(JSON.stringify(payload), d.deps);
    expect(d.shown).toHaveLength(1);
  });

  it("a window that is open but not focused: shows it, and doesn't ask the page", async () => {
    const w = windowClient({ focused: false, answer: { handled: true } });
    const d = deps([w.client]);
    await handlePush(JSON.stringify(payload), d.deps);
    expect(w.posted).toEqual([]);
    expect(d.shown).toHaveLength(1);
  });

  it("whenOpen banner: always shows, never asks the page", async () => {
    const w = windowClient({ answer: { handled: true } });
    const d = deps([w.client]);
    await handlePush(JSON.stringify({ ...payload, whenOpen: "banner" }), d.deps);
    expect(w.posted).toEqual([]);
    expect(d.shown).toHaveLength(1);
  });

  it("no tag: the notification has none", async () => {
    const d = deps([]);
    const { tag: _, ...noTag } = payload;
    await handlePush(JSON.stringify(noTag), d.deps);
    expect(d.shown[0]?.options).toEqual({
      body: "Your guess.",
      data: { url: "https://cb.example/room/KQTP" },
    });
  });

  it("a payload that isn't one, or none, shows nothing and throws nothing", async () => {
    for (const raw of [null, "", "not json", JSON.stringify({ title: "x" })]) {
      const d = deps([]);
      await handlePush(raw, d.deps);
      expect(d.shown).toEqual([]);
    }
  });

  it("waits at most PAGE_ANSWER_MS for the page", () => {
    expect(PAGE_ANSWER_MS).toBe(1000);
  });
});

describe("tapping the notification", () => {
  it("focuses a window already on that page, without moving it", async () => {
    let focused = false;
    const went: string[] = [];
    const w = windowClient({
      focus: async () => {
        focused = true;
        return w.client;
      },
      navigate: async (u) => {
        went.push(u);
        return w.client;
      },
    });
    const opened: string[] = [];
    await handleClick(
      { url: "https://cb.example/room/KQTP" },
      { clients: async () => [w.client], open: async (u) => void opened.push(u) },
    );
    expect(focused).toBe(true);
    expect(went).toEqual([]);
    expect(opened).toEqual([]);
  });

  it("takes an open window of the game to the page", async () => {
    const went: string[] = [];
    const w = windowClient({
      url: "https://cb.example/",
      navigate: async (u) => (went.push(u), w.client),
    });
    await handleClick(
      { url: "https://cb.example/room/KQTP" },
      { clients: async () => [w.client], open: async () => {} },
    );
    expect(went).toEqual(["https://cb.example/room/KQTP"]);
  });

  it("opens a window when none is open", async () => {
    const opened: string[] = [];
    await handleClick(
      { url: "https://cb.example/room/KQTP" },
      { clients: async () => [], open: async (u) => void opened.push(u) },
    );
    expect(opened).toEqual(["https://cb.example/room/KQTP"]);
  });

  it("no url in the notification: does nothing", async () => {
    const opened: string[] = [];
    await handleClick(null, { clients: async () => [], open: async (u) => void opened.push(u) });
    await handleClick(
      { url: 3 },
      { clients: async () => [], open: async (u) => void opened.push(u) },
    );
    expect(opened).toEqual([]);
  });
});

describe("a push event's data", () => {
  it("is its text, or null when the push carries none", () => {
    expect(pushText({ text: () => "hi" })).toBe("hi");
    expect(pushText(null)).toBeNull();
    expect(pushText(undefined)).toBeNull();
  });
});
