/// <reference lib="webworker" />
/**
 * OGS's service worker for a game's own site (spec §9). Copy dist/sw.js to your origin root
 * (`/sw.js`); subscribeOgsPush registers it. It shows OGS pushes, or hands one to a focused window
 * of the game whose page listens (onOgsNotification), and opens the game at the push's url on a tap.
 */
import { type ClientLike, handleClick, handlePush } from "./sw-core";

declare const self: ServiceWorkerGlobalScope;

const asClient = (wc: WindowClient): ClientLike => ({
  url: wc.url,
  focused: wc.focused,
  postMessage: (message, ports) =>
    wc.postMessage(
      message,
      ports.filter((p): p is MessagePort => p instanceof MessagePort),
    ),
  focus: () => wc.focus(),
  navigate: (url) => wc.navigate(url),
});

const windows = async () =>
  (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).flatMap((c) =>
    c instanceof WindowClient ? [asClient(c)] : [],
  );

self.addEventListener("push", (event) => {
  event.waitUntil(
    handlePush(event.data?.text() ?? null, {
      clients: windows,
      show: (title, options) => self.registration.showNotification(title, options),
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    handleClick(event.notification.data, {
      clients: windows,
      open: (url) => self.clients.openWindow(url),
    }),
  );
});

// Take over at once, so the first push after subscribing reaches this worker.
self.addEventListener("install", () => void self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
