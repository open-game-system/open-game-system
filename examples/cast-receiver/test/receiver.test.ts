import { test, expect } from "@playwright/test";
import path from "node:path";

const receiverPath = path.resolve(__dirname, "..", "receiver.html");

function receiverUrl(params?: Record<string, string>): string {
  const url = new URL(`file://${receiverPath}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

/**
 * Inject mocks for WebSocket and RTCPeerConnection before the page script runs.
 * Returns handles on window.__mocks for test assertions and triggering events.
 */
async function injectMocks(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const mocks = {
      ws: null as any,
      pc: null as any,
    };

    class MockWebSocket {
      static OPEN = 1;
      static CLOSED = 3;

      url: string;
      readyState = 1; // OPEN
      onopen: ((ev: any) => void) | null = null;
      onclose: ((ev: any) => void) | null = null;
      onmessage: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;

      constructor(url: string) {
        this.url = url;
        mocks.ws = this;
        // Auto-fire onopen async so the page script has time to attach handlers
        setTimeout(() => this.onopen?.({} as any), 10);
      }

      send(_data: string) {}
      close() {
        this.readyState = 3;
        // Don't auto-fire onclose — real WebSocket fires it asynchronously
        // and cleanup() sets signalingSocket = null after calling close(),
        // so firing onclose synchronously would cause the handler to run
        // before cleanup finishes, producing wrong status messages.
      }
    }

    (window as any).WebSocket = MockWebSocket;

    class MockRTCPeerConnection {
      connectionState = "new";
      localDescription: any = null;

      _onconnectionstatechange: ((ev: any) => void) | null = null;
      _ontrack: ((ev: any) => void) | null = null;
      _onicecandidate: ((ev: any) => void) | null = null;

      constructor() {
        mocks.pc = this;
      }

      set onconnectionstatechange(fn: any) {
        this._onconnectionstatechange = fn;
      }
      get onconnectionstatechange() {
        return this._onconnectionstatechange;
      }

      set ontrack(fn: any) {
        this._ontrack = fn;
      }
      get ontrack() {
        return this._ontrack;
      }

      set onicecandidate(fn: any) {
        this._onicecandidate = fn;
      }
      get onicecandidate() {
        return this._onicecandidate;
      }

      addTransceiver() {}
      createOffer() {
        return Promise.resolve({ type: "offer", sdp: "mock-offer" });
      }
      createAnswer() {
        return Promise.resolve({ type: "answer", sdp: "mock-answer" });
      }
      setLocalDescription(desc: any) {
        this.localDescription = desc;
        return Promise.resolve();
      }
      setRemoteDescription() {
        return Promise.resolve();
      }
      addIceCandidate() {
        return Promise.resolve();
      }
      close() {}
    }

    (window as any).RTCPeerConnection = MockRTCPeerConnection;
    (window as any).RTCSessionDescription = class {
      constructor(d: any) {
        Object.assign(this, d);
      }
    };
    (window as any).RTCIceCandidate = class {
      constructor(d: any) {
        Object.assign(this, d);
      }
    };

    (window as any).__mocks = mocks;
  });
}

test.describe("Cast Receiver", () => {
  test("no stream URL provided — shows error, no spinner", async ({ page }) => {
    await injectMocks(page);
    await page.goto(receiverUrl());

    const statusText = page.locator("#status-text");
    await expect(statusText).toHaveText("No stream URL provided");

    const spinner = page.locator("#spinner");
    await expect(spinner).toHaveCSS("display", "none");
  });

  test("shows loading state with spinner when streamUrl is provided", async ({
    page,
  }) => {
    await injectMocks(page);
    await page.goto(receiverUrl({ streamUrl: "wss://test.example.com/stream" }));

    const statusText = page.locator("#status-text");
    await expect(statusText).toHaveText("Connecting to game stream...");

    const spinner = page.locator("#spinner");
    await expect(spinner).toHaveCSS("display", "block");
  });

  test("connection timeout after 15 seconds — shows timeout message, no spinner", async ({
    page,
  }) => {
    // Override the timeout constant to 500ms for faster testing
    await page.addInitScript(() => {
      const originalScript = document.createElement("script");
      // We'll intercept setTimeout to speed up the 15s timeout
      const _origSetTimeout = window.setTimeout;
      (window as any).setTimeout = function (fn: any, delay: number, ...args: any[]) {
        // Map the 15000ms connection timeout to 500ms
        if (delay === 15000) {
          return _origSetTimeout(fn, 500, ...args);
        }
        return _origSetTimeout(fn, delay, ...args);
      };
    });

    await injectMocks(page);
    await page.goto(receiverUrl({ streamUrl: "wss://test.example.com/stream" }));

    // Initially should show connecting
    const statusText = page.locator("#status-text");
    await expect(statusText).toHaveText("Connecting to game stream...");

    // Wait for timeout to fire (mapped to 500ms)
    await expect(statusText).toHaveText("Connection timed out", { timeout: 3000 });

    const spinner = page.locator("#spinner");
    await expect(spinner).toHaveCSS("display", "none");
  });

  test("stream ends gracefully — shows cast session ended", async ({ page }) => {
    await injectMocks(page);
    await page.goto(receiverUrl({ streamUrl: "wss://test.example.com/stream" }));

    // Wait for mocks to be ready
    await page.waitForFunction(() => (window as any).__mocks?.pc !== null);

    // Simulate connected state
    await page.evaluate(() => {
      const pc = (window as any).__mocks.pc;
      pc.connectionState = "connected";
      pc._onconnectionstatechange?.({});
    });

    // Verify overlay is hidden when connected
    const overlay = page.locator("#status-overlay");
    await expect(overlay).toHaveClass(/hidden/);

    // Simulate closed state (graceful end)
    await page.evaluate(() => {
      const pc = (window as any).__mocks.pc;
      pc.connectionState = "closed";
      pc._onconnectionstatechange?.({});
    });

    const statusText = page.locator("#status-text");
    await expect(statusText).toHaveText("Cast session ended");

    const spinner = page.locator("#spinner");
    await expect(spinner).toHaveCSS("display", "none");
  });

  test("no interactive elements in the DOM when streaming", async ({ page }) => {
    await injectMocks(page);
    await page.goto(receiverUrl({ streamUrl: "wss://test.example.com/stream" }));

    // Wait for mocks and simulate connected state
    await page.waitForFunction(() => (window as any).__mocks?.pc !== null);
    await page.evaluate(() => {
      const pc = (window as any).__mocks.pc;
      pc.connectionState = "connected";
      pc._onconnectionstatechange?.({});
    });

    // Verify no buttons, links, or other interactive elements
    const buttons = await page.locator("button").count();
    const links = await page.locator("a").count();
    const inputs = await page.locator("input").count();
    const selects = await page.locator("select").count();
    const textareas = await page.locator("textarea").count();

    expect(buttons).toBe(0);
    expect(links).toBe(0);
    expect(inputs).toBe(0);
    expect(selects).toBe(0);
    expect(textareas).toBe(0);
  });

  test("video element has object-fit: contain for aspect ratio handling", async ({
    page,
  }) => {
    await injectMocks(page);
    await page.goto(receiverUrl({ streamUrl: "wss://test.example.com/stream" }));

    const video = page.locator("video");
    await expect(video).toHaveCSS("object-fit", "contain");
  });
});
