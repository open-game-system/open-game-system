/**
 * OGS's sw.js in a real browser (spec §9, "Arriving while the game is open"). A local page registers
 * the built dist/sw.js; pushes arrive through DevTools' ServiceWorker.deliverPushMessage (a synthetic
 * push: the encryption is proven in services/api's tests). Run after `pnpm build`.
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const SW = readFileSync(resolve(__dirname, "../dist/sw.js"), "utf8");
const PAGE = `<!doctype html><title>game</title><script>
  window.__heard = [];
  window.__handle = false;
  navigator.serviceWorker.addEventListener("message", (ev) => {
    if (ev.data?.type !== "ogs:notification") return;
    window.__heard.push(ev.data.notification.title);
    if (window.__handle) ev.ports[0]?.postMessage({ handled: true });
  });
  window.__ready = navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);
</script>`;

let server: Server;
let origin: string;
let browser: Browser;
let context: BrowserContext;
let page: Page;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/sw.js") {
      res.writeHead(200, { "Content-Type": "text/javascript", "Service-Worker-Allowed": "/" });
      res.end(SW);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(PAGE);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  origin = `http://localhost:${address.port}`;
});
afterAll(() => new Promise((r) => server.close(r)));

beforeEach(async () => {
  // A browser per test: DevTools lists service worker registrations across contexts, so a shared
  // browser can hand the push to an earlier test's registration. Full Chromium (new headless): the
  // headless shell has no notifications.
  browser = await chromium.launch({ channel: "chromium" });
  context = await browser.newContext();
  await context.grantPermissions(["notifications"], { origin });
  page = await context.newPage();
  await page.goto(`${origin}/`);
  await page.evaluate(() => Reflect.get(window, "__ready"));
  // The worker claims the page; wait until it controls it.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
});
afterEach(async () => {
  devtools = null;
  await browser?.close();
});

/** The page's registration, found once per test through one DevTools session that stays open. */
let devtools: Promise<(data: string) => Promise<unknown>> | null = null;
function deliverer() {
  devtools ??= (async () => {
    const cdp = await context.newCDPSession(page);
    const registrationId = await new Promise<string>((resolveId) => {
      cdp.on(
        "ServiceWorker.workerRegistrationUpdated",
        (e: { registrations: { registrationId: string; isDeleted: boolean }[] }) => {
          const live = e.registrations.find((r) => !r.isDeleted);
          if (live) resolveId(live.registrationId);
        },
      );
      void cdp.send("ServiceWorker.enable");
    });
    return (data: string) =>
      cdp.send("ServiceWorker.deliverPushMessage", { origin, registrationId, data });
  })();
  return devtools;
}

/** Delivers a push to the page's registration through DevTools. */
async function push(payload: object) {
  const deliver = await deliverer();
  await deliver(JSON.stringify(payload));
}

/**
 * The notifications the worker has shown, read inside the worker: reading them from the page
 * (`navigator.serviceWorker.ready.getNotifications()`) sometimes came back empty in headless Chromium
 * while the worker's own registration listed them.
 */
const shown = async () => {
  const worker = context.serviceWorkers()[0];
  if (!worker) return [];
  return worker.evaluate(async () => {
    const registration: unknown = Reflect.get(globalThis, "registration");
    if (!(registration instanceof ServiceWorkerRegistration)) return [];
    return (await registration.getNotifications()).map((n) => ({
      title: n.title,
      tag: n.tag,
      url: n.data?.url,
    }));
  });
};
const heard = () => page.evaluate(() => Reflect.get(window, "__heard"));

const payload = {
  title: "Clue: RIVER 2",
  body: "Your guess.",
  url: "http://localhost/room/KQTP",
  whenOpen: "deliver",
  tag: "cb-KQTP",
};

describe("sw.js in Chromium", () => {
  it("no page handler: the notification shows, with its tag and url", async () => {
    await page.bringToFront();
    await push(payload);
    await expect
      .poll(shown, { timeout: 10_000 })
      .toEqual([{ title: "Clue: RIVER 2", tag: "cb-KQTP", url: "http://localhost/room/KQTP" }]);
  });

  it("a focused page that handles it: the page hears it and no notification shows", async () => {
    await page.evaluate(() => Reflect.set(window, "__handle", true));
    await page.bringToFront();
    await push(payload);
    await expect.poll(heard, { timeout: 10_000 }).toEqual(["Clue: RIVER 2"]);
    await page.waitForTimeout(1500);
    expect(await shown()).toEqual([]);
  });

  it("whenOpen banner: shows even with a handler", async () => {
    await page.evaluate(() => Reflect.set(window, "__handle", true));
    await page.bringToFront();
    await push({ ...payload, whenOpen: "banner" });
    await expect.poll(shown, { timeout: 10_000 }).toHaveLength(1);
    expect(await heard()).toEqual([]);
  });

  it("a later push with the same tag replaces the first", async () => {
    await push(payload);
    await expect.poll(shown, { timeout: 10_000 }).toHaveLength(1);
    await push({ ...payload, title: "Clue: STONE 3" });
    await expect
      .poll(async () => (await shown()).map((n) => n.title), { timeout: 10_000 })
      .toEqual(["Clue: STONE 3"]);
  });
});
