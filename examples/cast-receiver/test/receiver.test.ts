import path from "node:path";
import { expect, test } from "@playwright/test";

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
 * Inject mocks for PeerJS Peer, fetch, WebSocket, and RTCPeerConnection
 * before the page script runs.
 * Returns handles on window.__mocks for test assertions and triggering events.
 */
async function injectMocks(page: import("@playwright/test").Page) {
  // Block the PeerJS CDN script so our mock Peer constructor isn't overwritten
  await page.route("**/peerjs**", (route) => {
    route.fulfill({ status: 200, contentType: "application/javascript", body: "/* blocked */" });
  });

  await page.addInitScript(() => {
    const mocks = {
      ws: null as any,
      pc: null as any,
      peer: null as any,
      lastCall: null as any,
    };

    // --- Mock WebSocket (kept for completeness) ---
    class MockWebSocket {
      static OPEN = 1;
      static CLOSED = 3;

      url: string;
      readyState = 1;
      onopen: ((ev: any) => void) | null = null;
      onclose: ((ev: any) => void) | null = null;
      onmessage: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;

      constructor(url: string) {
        this.url = url;
        mocks.ws = this;
        setTimeout(() => this.onopen?.({} as any), 10);
      }

      send(_data: string) {}
      close() {
        this.readyState = 3;
      }
    }

    (window as any).WebSocket = MockWebSocket;

    // --- Mock RTCPeerConnection (kept for completeness) ---
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

    // --- Mock PeerJS Peer ---
    class MockPeer {
      id: string;
      _handlers: Record<string, Array<(...args: any[]) => void>> = {};
      destroyed = false;

      constructor(id: string, _opts?: any) {
        this.id = id;
        mocks.peer = this;

        // Auto-fire 'open' event asynchronously so the page script's
        // await promise resolves
        setTimeout(() => {
          this._emit("open", id);
        }, 10);
      }

      on(event: string, fn: (...args: any[]) => void) {
        if (!this._handlers[event]) {
          this._handlers[event] = [];
        }
        this._handlers[event].push(fn);
        return this;
      }

      off(event: string, fn: (...args: any[]) => void) {
        if (this._handlers[event]) {
          this._handlers[event] = this._handlers[event].filter((h: any) => h !== fn);
        }
        return this;
      }

      _emit(event: string, ...args: any[]) {
        const handlers = this._handlers[event];
        if (handlers) {
          for (const h of handlers) {
            h(...args);
          }
        }
      }

      destroy() {
        this.destroyed = true;
      }

      disconnect() {}
    }

    // Override window.Peer (PeerJS attaches itself here from CDN)
    (window as any).Peer = MockPeer;

    // --- Mock fetch for stream server endpoints ---
    const _origFetch = window.fetch;
    (window as any).fetch = (input: string | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;

      // ICE servers endpoint — return default
      if (url.endsWith("/ice-servers")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }

      // Start stream endpoint — return success
      if (url.endsWith("/start-stream")) {
        return Promise.resolve(
          new Response(JSON.stringify({ status: "success", streamId: "mock-stream-123" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      // Fall through to real fetch for anything else
      return _origFetch.call(window, input, init);
    };

    (window as any).__mocks = mocks;
  });
}

/**
 * Helper: create a mock MediaConnection (PeerJS call) and emit it on the peer.
 * Returns a handle to the call object for further event simulation.
 */
function emitPeerCall(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const peer = (window as any).__mocks.peer;
    // Build a mock MediaConnection
    const call: any = {
      peer: "mock-streamer",
      _handlers: {} as Record<string, Array<(...args: any[]) => void>>,

      on(event: string, fn: (...args: any[]) => void) {
        if (!this._handlers[event]) this._handlers[event] = [];
        this._handlers[event].push(fn);
        return this;
      },

      _emit(event: string, ...args: any[]) {
        const handlers = this._handlers[event];
        if (handlers) {
          for (const h of handlers) h(...args);
        }
      },

      answer() {},
      close() {},
    };

    (window as any).__mocks.lastCall = call;
    peer._emit("call", call);
  });
}

test.describe("Cast Receiver", () => {
  test("no stream URL provided — shows error, no spinner", async ({ page }) => {
    await injectMocks(page);
    await page.goto(receiverUrl());

    const statusText = page.locator("#status-text");
    await expect(statusText).toHaveText("Unable to connect to game stream");

    const spinner = page.locator("#spinner");
    await expect(spinner).toHaveCSS("display", "none");
  });

  test("shows loading state with spinner when streamUrl is provided", async ({ page }) => {
    await injectMocks(page);
    await page.goto(receiverUrl({ streamUrl: "wss://test.example.com/stream" }));

    // After PeerJS connects and fetch succeeds, status should be
    // "Waiting for video stream..." (the final status before a call arrives)
    const statusText = page.locator("#status-text");
    await expect(statusText).toHaveText("Waiting for video stream...");

    const spinner = page.locator("#spinner");
    await expect(spinner).toHaveCSS("display", "block");
  });

  test("connection timeout after 30 seconds — shows timeout message, no spinner", async ({
    page,
  }) => {
    // Override the timeout constant to 500ms for faster testing
    await page.addInitScript(() => {
      const _origSetTimeout = window.setTimeout;
      (window as any).setTimeout = (fn: any, delay: number, ...args: any[]) => {
        // Map the 30000ms connection timeout to 500ms
        if (delay === 30000) {
          return _origSetTimeout(fn, 500, ...args);
        }
        return _origSetTimeout(fn, delay, ...args);
      };
    });

    await injectMocks(page);
    await page.goto(receiverUrl({ streamUrl: "wss://test.example.com/stream" }));

    // Initially should show a connecting/waiting state
    const statusText = page.locator("#status-text");
    await expect(statusText).toHaveText("Waiting for video stream...");

    // Wait for timeout to fire (mapped to 500ms)
    await expect(statusText).toHaveText("Connection timed out", { timeout: 3000 });

    const spinner = page.locator("#spinner");
    await expect(spinner).toHaveCSS("display", "none");
  });

  test("stream ends gracefully — shows cast session ended", async ({ page }) => {
    await injectMocks(page);
    await page.goto(receiverUrl({ streamUrl: "wss://test.example.com/stream" }));

    // Wait for peer to be ready and stream request to complete
    await page.waitForFunction(() => (window as any).__mocks?.peer !== null);
    await page.locator("#status-text").filter({ hasText: "Waiting for video stream..." }).waitFor();

    // Simulate an incoming call
    await emitPeerCall(page);

    // Simulate receiving a stream — this triggers hideOverlay()
    await page.evaluate(() => {
      const call = (window as any).__mocks.lastCall;
      // Create a fake MediaStream
      const stream = new MediaStream();
      call._emit("stream", stream);
    });

    // Verify overlay is hidden when connected
    const overlay = page.locator("#status-overlay");
    await expect(overlay).toHaveClass(/hidden/);

    // Simulate call close (graceful end)
    await page.evaluate(() => {
      const call = (window as any).__mocks.lastCall;
      call._emit("close");
    });

    const statusText = page.locator("#status-text");
    await expect(statusText).toHaveText("Cast session ended");

    const spinner = page.locator("#spinner");
    await expect(spinner).toHaveCSS("display", "none");
  });

  test("no interactive elements in the DOM when streaming", async ({ page }) => {
    await injectMocks(page);
    await page.goto(receiverUrl({ streamUrl: "wss://test.example.com/stream" }));

    // Wait for peer to be ready and stream request to complete
    await page.waitForFunction(() => (window as any).__mocks?.peer !== null);
    await page.locator("#status-text").filter({ hasText: "Waiting for video stream..." }).waitFor();

    // Simulate an incoming call with stream
    await emitPeerCall(page);
    await page.evaluate(() => {
      const call = (window as any).__mocks.lastCall;
      const stream = new MediaStream();
      call._emit("stream", stream);
    });

    // Verify overlay is hidden
    const overlay = page.locator("#status-overlay");
    await expect(overlay).toHaveClass(/hidden/);

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

  test("video element has object-fit: contain for aspect ratio handling", async ({ page }) => {
    await injectMocks(page);
    await page.goto(receiverUrl({ streamUrl: "wss://test.example.com/stream" }));

    const video = page.locator("video");
    await expect(video).toHaveCSS("object-fit", "contain");
  });
});
