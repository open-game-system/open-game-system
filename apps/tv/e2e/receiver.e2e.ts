import type { Browser, BrowserContext, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, launch, ROCKET_TV } from "./harness";

/**
 * The local Cast receiver (src/receiver) in Chrome made to look like a Chromecast with Google TV:
 * its user agent, a 1280×720 screen, the CPU slowed 4× through DevTools. The phone is played by the
 * test: through the relay (?signal=test) or a fake CAF `cast` global, as on a device. It frames the
 * launcher (fake couch) from its own site with the tier, and the framed game gets the tier in
 * ogs:start. Receiver events are caught at the API's /client-events route.
 */
const GOOGLE_TV_UA =
  "Mozilla/5.0 (Linux; Android 12.0; Build/STTL.240206.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 CrKey/1.56.500000 DeviceType/AndroidTV";
const PROD_API = "https://opengame-api.jonathanrmumm.workers.dev";

declare global {
  interface Window {
    __out?: unknown[];
    received?: { type: string }[];
  }
}

type Posted = {
  context: { app: string; platform: string };
  events: { name: string; data?: Record<string, unknown> }[];
};

/**
 * Headless Chromium has no WebGL unless told to use the GPU: on a Mac, ANGLE on Metal (a real GPU,
 * so the Google TV cap decides: lite). Elsewhere (CI) there is no GPU, so the receiver must say minimal.
 */
const GPU_ARGS = process.platform === "darwin" ? ["--use-angle=metal"] : [];
const EXPECTED_TIER = process.platform === "darwin" ? "lite" : "minimal";

let browser: Browser;
let noGl: Browser;
beforeAll(async () => {
  browser = await launch(GPU_ARGS);
  noGl = await launch();
});
afterAll(async () => {
  await browser.close();
  await noGl.close();
});

/** A fake game TV page on the game's origin: keeps every launcher message it gets. */
const GAME_PAGE = `<!doctype html><body style="margin:0;background:#123"><script>
window.received=[];addEventListener("message",(e)=>window.received.push(e.data));</script></body>`;

async function castDevice(
  opts: { caf?: boolean } = {},
): Promise<{ ctx: BrowserContext; page: Page; posted: Posted[] }> {
  const ctx = await browser.newContext({
    userAgent: GOOGLE_TV_UA,
    viewport: { width: 1280, height: 720 },
  });
  // A Chromecast with Google TV has 2 GB (navigator.deviceMemory 2); this Mac says 8.
  await ctx.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "deviceMemory", { get: () => 2 }),
  );
  const posted: Posted[] = [];
  await ctx.route(`${PROD_API}/api/v1/client-events`, async (r) => {
    posted.push(JSON.parse(r.request().postData() ?? "{}"));
    await r.fulfill({ status: 202, body: "{}" });
  });
  await ctx.route("https://rocket-crew.jonathanrmumm.workers.dev/**", (r) =>
    r.fulfill({ contentType: "text/html", body: GAME_PAGE }),
  );
  // The real CAF script only starts on a Cast device; here a fake `cast` global stands in for it.
  await ctx.route("https://www.gstatic.com/cast/**", (r) =>
    r.fulfill({ contentType: "text/javascript", body: "" }),
  );
  if (opts.caf)
    await ctx.addInitScript(() => {
      const listeners: Record<string, ((e: { senderId: string }) => void)[]> = {};
      let custom: ((e: { data: unknown; senderId: string }) => void) | null = null;
      window.__out = [];
      const ctxObj = {
        addCustomMessageListener: (_ns: string, h: typeof custom) => {
          custom = h;
        },
        sendCustomMessage: (_ns: string, to: string | undefined, data: unknown) =>
          window.__out?.push({ to, data }),
        addEventListener: (t: string, h: (e: { senderId: string }) => void) => {
          listeners[t] = [...(listeners[t] ?? []), h];
        },
        getSenders: () => [{}],
        start: () =>
          setTimeout(() => {
            for (const h of listeners.senderconnected ?? []) h({ senderId: "phone" });
          }, 50),
        stop: () => window.__out?.push({ stopped: true }),
        canDisplayType: () => false,
      };
      Object.assign(window, {
        cast: {
          framework: {
            CastReceiverContext: { getInstance: () => ctxObj },
            CastReceiverOptions: class {},
            system: {
              EventType: {
                SENDER_CONNECTED: "senderconnected",
                SENDER_DISCONNECTED: "senderdisconnected",
              },
              MessageType: { JSON: "JSON" },
            },
          },
        },
        __phoneSend: (data: unknown) => custom?.({ data, senderId: "phone" }),
      });
    });
  else
    await ctx.addInitScript(() => {
      window.__out = [];
      window.__ogsSignalOut = (d: unknown) => window.__out?.push({ data: d });
    });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(`${BASE}/receiver.html${opts.caf ? "" : "?signal=test"}`);
  return { ctx, page, posted };
}

const out = (page: Page) =>
  page.evaluate(() => (window.__out ?? []) as { to?: string; data?: { type?: string } }[]);
const phoneSends = (page: Page, data: unknown, caf: boolean) =>
  page.evaluate(
    ({ d, viaCaf }) => {
      const w = window as unknown as Record<string, (x: unknown) => void>;
      (viaCaf ? w.__phoneSend : w.__ogsSignalIn)?.(d);
    },
    { d: data, viaCaf: caf },
  );

/** Drives the framed launcher's fake couch: start Rocket Crew and declare its TV page. */
async function startRocketCrew(page: Page) {
  const launcher = page.frame({ url: /\/\?fake=1/ });
  if (!launcher) throw new Error("launcher frame missing");
  await launcher.waitForFunction(() => !!window.__ogsFake);
  for (const m of [
    { type: "focus.set", itemId: "game:rocket-crew" },
    { type: "select", deviceId: "jonathan-phone" },
    { type: "select", deviceId: "jonathan-phone" },
    { type: "game.view", appId: "rocket-crew", url: ROCKET_TV },
  ])
    await launcher.evaluate((msg) => window.__ogsFake?.send(msg as never), m);
  return launcher;
}

const gotStart = async (page: Page) => {
  const game = page.frame({ url: /rocket-crew/ });
  if (!game) return null;
  const got = await game.evaluate(() => window.received ?? []);
  return got.find((m) => m.type === "ogs:start") ?? null;
};

describe.each([
  ["relay (?signal=test)", false],
  ["CAF (fake cast global)", true],
])("the local Cast receiver on an emulated Chromecast with Google TV, %s", (_name, caf) => {
  it("asks for the view, frames the launcher with its tier, and the game gets the tier in ogs:start", async () => {
    const { ctx, page, posted } = await castDevice({ caf });
    await expect
      .poll(async () => (await out(page)).some((m) => m.data?.type === "REQUEST_VIEW"), {
        timeout: 10_000,
      })
      .toBe(true);

    // What the phone sends (packages/shell/src/cast-view.ts): the launcher URL, plus the old stream server.
    const view = {
      type: "LOAD_VIEW",
      viewUrl: "https://ogs-tv.pages.dev/?fake=1",
      streamServerUrl: "https://ignored.example",
      attemptId: "cast-e2e",
      sessionId: "s-e2e",
    };
    await phoneSends(page, view, caf);
    await phoneSends(page, view, caf);
    await expect
      .poll(() => page.locator("#view").getAttribute("data-loaded"), { timeout: 15_000 })
      .toBe("1");
    expect(await page.locator("#view").getAttribute("src")).toBe(
      `${BASE}/?fake=1&tier=${EXPECTED_TIER}`,
    );
    expect(await page.getByTestId("rx-status").getAttribute("data-hidden")).toBe("1");

    await startRocketCrew(page);
    await expect
      .poll(() => gotStart(page), { timeout: 15_000 })
      .toMatchObject({ type: "ogs:start", tier: EXPECTED_TIER });

    await phoneSends(page, { type: "GET_STATE" }, caf);
    await expect
      .poll(async () => (await out(page)).find((m) => m.data?.type === "STATE")?.data, {
        timeout: 5000,
      })
      .toMatchObject({
        tier: EXPECTED_TIER,
        deviceClass: "google-tv",
        loaded: true,
        view: "ogs-tv.pages.dev",
      });

    // Fake couch: no API in the URL, so the log goes to production's after 15 s (caught here).
    await expect.poll(() => posted.length, { timeout: 20_000, interval: 1000 }).toBeGreaterThan(0);
    const events = posted.flatMap((p) => p.events);
    expect(posted[0]?.context).toMatchObject({ app: "receiver", platform: "google-tv" });
    const names = events.map((e) => e.name);
    for (const n of [
      "receiver.launched",
      "receiver.tier",
      "receiver.load_view.received",
      "receiver.view.loaded",
      "receiver.sender",
    ])
      expect(names).toContain(n);
    expect(names.filter((n) => n === "receiver.load_view.received")).toHaveLength(1);
    const tier = events.find((e) => e.name === "receiver.tier");
    expect(tier?.data).toMatchObject({ tier: EXPECTED_TIER, deviceClass: "google-tv" });
    expect(JSON.stringify(events)).not.toContain("token=");
    console.log("[receiver.e2e] tier event:", JSON.stringify(tier?.data));
    await ctx.close();
  }, 60_000);
});

describe("the receiver's tier override (?tier=, for device tests)", () => {
  it("frames the launcher with the forced tier", async () => {
    const ctx = await browser.newContext({
      userAgent: GOOGLE_TV_UA,
      viewport: { width: 1280, height: 720 },
    });
    await ctx.route("https://www.gstatic.com/cast/**", (r) =>
      r.fulfill({ contentType: "text/javascript", body: "" }),
    );
    await ctx.route(`${PROD_API}/**`, (r) => r.fulfill({ status: 202, body: "{}" }));
    const page = await ctx.newPage();
    await page.goto(`${BASE}/receiver.html?signal=test&tier=minimal`);
    await page.waitForFunction(() => typeof window.__ogsSignalIn === "function");
    await page.evaluate(() =>
      window.__ogsSignalIn?.({ type: "LOAD_VIEW", viewUrl: "https://ogs-tv.pages.dev/?fake=1" }),
    );
    await expect
      .poll(() => page.locator("#view").getAttribute("src"), { timeout: 10_000 })
      .toBe(`${BASE}/?fake=1&tier=minimal`);
    await ctx.close();
  });
});

describe("a device with no WebGL", () => {
  it("is minimal, and says why", async () => {
    const ctx = await noGl.newContext({
      userAgent: GOOGLE_TV_UA,
      viewport: { width: 1280, height: 720 },
    });
    await ctx.route("https://www.gstatic.com/cast/**", (r) =>
      r.fulfill({ contentType: "text/javascript", body: "" }),
    );
    await ctx.route(`${PROD_API}/**`, (r) => r.fulfill({ status: 202, body: "{}" }));
    await ctx.addInitScript(() => {
      window.__out = [];
      window.__ogsSignalOut = (d: unknown) => window.__out?.push({ data: d });
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/receiver.html?signal=test`);
    await page.waitForFunction(() => typeof window.__ogsSignalIn === "function");
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.__ogsSignalIn?.({ type: "GET_STATE" }));
          return (await out(page))
            .map((m) => m.data)
            .find((d) => d?.type === "STATE" && "tier" in d && d.tier);
        },
        { timeout: 10_000 },
      )
      .toMatchObject({ tier: "minimal", reasons: expect.arrayContaining(["no-webgl"]), gpu: null });
    await ctx.close();
  });
});

describe("opened outside a Cast device and with no relay", () => {
  it("says to cast from the OGS app", async () => {
    const ctx = await browser.newContext();
    await ctx.route("https://www.gstatic.com/cast/**", (r) =>
      r.fulfill({ contentType: "text/javascript", body: "" }),
    );
    const page = await ctx.newPage();
    await page.goto(`${BASE}/receiver.html`);
    await expect
      .poll(() => page.locator("#status-text").textContent())
      .toBe("Cast to this TV from the OGS app");
    await ctx.close();
  });
});

describe("the whole chain on the registered Cast receiver page (apps/web/public/receiver.html)", () => {
  it("the Cast receiver page frames this TV receiver, which frames the launcher; the game gets the tier", async () => {
    const { readFileSync } = await import("node:fs");
    const RECEIVER_PAGE = readFileSync(
      new URL("../../web/public/receiver.html", import.meta.url),
      "utf8",
    );
    const ctx = await browser.newContext({
      userAgent: GOOGLE_TV_UA,
      viewport: { width: 1280, height: 720 },
    });
    await ctx.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, "deviceMemory", { get: () => 2 }),
    );
    await ctx.route(`${PROD_API}/**`, (r) => r.fulfill({ status: 202, body: "{}" }));
    await ctx.route("https://api.ogs.test/**", (r) => r.fulfill({ status: 202, body: "{}" }));
    await ctx.route("https://www.gstatic.com/cast/**", (r) =>
      r.fulfill({ contentType: "text/javascript", body: "" }),
    );
    await ctx.route("https://rocket-crew.jonathanrmumm.workers.dev/**", (r) =>
      r.fulfill({ contentType: "text/html", body: GAME_PAGE }),
    );
    // opengame.org serves the registered receiver page; ogs-tv.pages.dev is this Vite server.
    await ctx.route("https://opengame.org/receiver.html*", (r) =>
      r.fulfill({ contentType: "text/html", body: RECEIVER_PAGE }),
    );
    await ctx.route("https://ogs-tv.pages.dev/**", async (r) => {
      const u = new URL(r.request().url());
      const res = await ctx.request.fetch(`${BASE}${u.pathname}${u.search}`);
      await r.fulfill({ response: res });
    });
    // CAF on the parent page: one phone, replies recorded in window.__out.
    await ctx.addInitScript(() => {
      if (location.host !== "opengame.org") return;
      const listeners: Record<string, ((e: { senderId: string }) => void)[]> = {};
      let custom: ((e: { data: unknown; senderId: string }) => void) | null = null;
      window.__out = [];
      const c = {
        addCustomMessageListener: (_ns: string, h: typeof custom) => {
          custom = h;
        },
        sendCustomMessage: (_ns: string, to: string | undefined, data: unknown) =>
          window.__out?.push({ to, data }),
        addEventListener: (t: string, h: (e: { senderId: string }) => void) => {
          listeners[t] = [...(listeners[t] ?? []), h];
        },
        getSenders: () => [{}],
        start: () => {},
        stop: () => window.__out?.push({ stopped: true }),
        canDisplayType: () => false,
      };
      Object.assign(window, {
        cast: {
          framework: {
            CastReceiverContext: { getInstance: () => c },
            CastReceiverOptions: class {},
            system: {
              EventType: {
                SENDER_CONNECTED: "senderconnected",
                SENDER_DISCONNECTED: "senderdisconnected",
              },
              MessageType: { JSON: "JSON" },
            },
          },
        },
        __phoneSend: (data: unknown) => custom?.({ data, senderId: "phone" }),
      });
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("https://opengame.org/receiver.html");
    // PR #55's LOAD_VIEW: the launcher URL and the phone's API.
    await phoneSends(
      page,
      {
        type: "LOAD_VIEW",
        viewUrl: "https://ogs-tv.pages.dev/?fake=1",
        apiUrl: "https://api.ogs.test",
        attemptId: "c1",
        sessionId: "s1",
      },
      true,
    );
    await expect
      .poll(() => page.locator("#local-view").getAttribute("src"), { timeout: 10_000 })
      .toBe("https://ogs-tv.pages.dev/receiver?host=parent&uhd=0");
    await expect
      .poll(() => !!page.frame({ url: /ogs-tv\.pages\.dev\/\?fake=1/ }), { timeout: 20_000 })
      .toBe(true);
    const launcherUrl = page.frame({ url: /ogs-tv\.pages\.dev\/\?fake=1/ })?.url();
    expect(launcherUrl).toBe(`https://ogs-tv.pages.dev/?fake=1&tier=${EXPECTED_TIER}`);
    await startRocketCrew(page);
    await expect
      .poll(() => gotStart(page), { timeout: 15_000 })
      .toMatchObject({ type: "ogs:start", tier: EXPECTED_TIER });
    // The phone's GET_STATE is answered by the TV receiver, through the parent's CAF.
    await phoneSends(page, { type: "GET_STATE" }, true);
    await expect
      .poll(async () => (await out(page)).find((m) => m.data?.type === "STATE")?.data, {
        timeout: 5000,
      })
      .toMatchObject({ tier: EXPECTED_TIER, loaded: true, deviceClass: "google-tv" });
    expect((await out(page)).find((m) => m.data?.type === "STATE")?.to).toBe("phone");
    await ctx.close();
  }, 60_000);
});
