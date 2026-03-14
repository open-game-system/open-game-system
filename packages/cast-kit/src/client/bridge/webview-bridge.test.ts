import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebViewBridge, createWebViewBridge, isInOpenGameApp } from './webview-bridge';
import type { Bridge } from './webview-bridge';
import type { BaseMessage } from './protocol';

describe('WebView Bridge', () => {
  let bridge: Bridge;
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageSpy = vi.fn();
    vi.stubGlobal('postMessage', postMessageSpy);
    // Mock setupMessageListener to avoid DOM listener issues in test env
    vi.spyOn(WebViewBridge.prototype as any, 'setupMessageListener').mockImplementation(() => {});
    bridge = createWebViewBridge();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a bridge instance', () => {
    expect(bridge).toBeDefined();
  });

  it('sends messages via postMessage', () => {
    const msg: BaseMessage = { type: 'TEST', payload: { key: 'value' } };
    bridge.sendMessage(msg);
    expect(postMessageSpy).toHaveBeenCalledWith(msg, '*');
  });

  it('requires requestId for sendMessageWithResponse', () => {
    expect(() => {
      bridge.sendMessageWithResponse({ type: 'TEST', payload: {} });
    }).toThrow('Message must have a requestId');
  });

  it('returns a promise from sendMessageWithResponse', () => {
    vi.useFakeTimers();
    const result = bridge.sendMessageWithResponse({
      type: 'TEST',
      payload: {},
      requestId: 'req-1'
    });
    expect(result).toBeInstanceOf(Promise);
    vi.useRealTimers();
  });

  it('rejects sendMessageWithResponse on timeout', async () => {
    vi.useFakeTimers();

    const promise = bridge.sendMessageWithResponse({
      type: 'TEST',
      payload: {},
      requestId: 'req-timeout'
    }, 50);

    vi.advanceTimersByTime(100);

    await expect(promise).rejects.toThrow('Request timed out');
    vi.useRealTimers();
  });

  it('cleans up resources when disposed', () => {
    vi.useFakeTimers();
    const testBridge = new WebViewBridge({ debug: false });

    // Start a pending request so there's something to clean up
    const promise = testBridge.sendMessageWithResponse({
      type: 'TEST',
      payload: {},
      requestId: 'cleanup-test'
    }).catch(() => {}); // Swallow the rejection from dispose

    testBridge.dispose();

    // pendingRequests should be cleared
    expect((testBridge as any).pendingRequests.size).toBe(0);
    vi.useRealTimers();
  });
});

describe('isInOpenGameApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when user agent contains OpenGame/', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 OpenGame/1.0'
    });
    expect(isInOpenGameApp()).toBe(true);
  });

  it('returns false for regular browser user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Safari/604.1'
    });
    expect(isInOpenGameApp()).toBe(false);
  });
});
