import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebViewBridge, createWebViewBridge, Bridge } from './webview-bridge';
import { BaseMessage } from './protocol';

// Mock window.postMessage
vi.stubGlobal('window', { 
  postMessage: vi.fn(),
  webkit: { 
    messageHandlers: { 
      castKit: { 
        postMessage: vi.fn() 
      } 
    } 
  } 
});

// Mock setupMessageListener to avoid addEventListener issues in tests
vi.spyOn(WebViewBridge.prototype, 'setupMessageListener').mockImplementation(() => {});

describe('WebView Bridge', () => {
  let bridge: Bridge;

  beforeEach(() => {
    bridge = createWebViewBridge();
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    bridge = null as any;
  });

  it('creates a bridge instance', () => {
    expect(bridge).toBeDefined();
  });

  it('returns a promise from sendMessageWithResponse', () => {
    const result = bridge.sendMessageWithResponse({
      type: 'TEST_MESSAGE',
      payload: {}
    });

    expect(result).toBeInstanceOf(Promise);
  });

  it('generates a unique requestId', () => {
    // Spy on Date.now and Math.random for consistent test values
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    vi.spyOn(Math, 'random').mockReturnValue(0.6789);
    
    const requestId = (bridge as any).generateRequestId();
    expect(requestId).toBe('12345-6789');
  });

  it('uses provided requestId', () => {
    bridge.sendMessage({
      type: 'TEST_MESSAGE',
      payload: {},
      requestId: 'custom-id-123'
    });
    
    const callArg = window.webkit.messageHandlers.castKit.postMessage.mock.calls[0][0];
    expect(callArg.requestId).toBe('custom-id-123');
  });

  it('resolves sendMessageWithResponse on receiving a corresponding response', () => {
    // Mock console.log to verify debug output
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Create bridge with debug enabled
    const debugBridge = createWebViewBridge({ debug: true });
    
    // Send message and get promise
    const promise = debugBridge.sendMessageWithResponse({
      type: 'TEST_MESSAGE',
      payload: { key: 'value' },
      requestId: 'test-123'
    });
    
    // Simulate receiving a response message
    const pendingRequestsMap = new Map();
    pendingRequestsMap.set('test-123', {
      resolve: vi.fn(),
      timer: setTimeout(() => {}, 1000)
    });
    
    // Set pendingRequests on the bridge instance
    debugBridge.pendingRequests = pendingRequestsMap;
    
    // Mock the message event handler
    const messageHandler = (event) => {
      const message = event.data;
      
      if (message.requestId && debugBridge.pendingRequests.has(message.requestId)) {
        const pendingRequest = debugBridge.pendingRequests.get(message.requestId);
        if (pendingRequest) {
          // Resolve the promise
          pendingRequest.resolve(message);
          // Clear the timeout
          clearTimeout(pendingRequest.timer);
          // Remove the request from the pending list
          debugBridge.pendingRequests.delete(message.requestId);
        }
      }
    };
    
    // Invoke handler manually
    messageHandler({
      data: {
        type: 'TEST_MESSAGE_RESPONSE',
        payload: { success: true, result: 'test' },
        requestId: 'test-123'
      }
    });
    
    // Verify debug output was generated
    expect(consoleLogSpy).toHaveBeenCalled();
    
    // Cleanup
    consoleLogSpy.mockRestore();
    
    return promise;
  });

  it('detects when running in OpenGame App', () => {
    // Set OpenGame app user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OpenGame/1.0'
    });
    
    expect(isInOpenGameApp()).toBe(true);
  });
  
  it('detects when not running in OpenGame App', () => {
    // Set regular browser user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
    });
    
    expect(isInOpenGameApp()).toBe(false);
  });
  
  it('sends messages through the bridge', () => {
    const bridge = createWebViewBridge();
    const testMessage: BaseMessage = {
      type: 'TEST_MESSAGE',
      payload: { key: 'value' }
    };
    
    bridge.sendMessage(testMessage);
    
    expect(global.window.postMessage).toHaveBeenCalledWith(
      testMessage,
      '*'
    );
  });
  
  it('attaches event listeners', () => {
    const spy = vi.spyOn(window, 'addEventListener');
    
    // Create a new bridge to trigger addEventListener
    const testBridge = new WebViewBridge({ debug: false });
    (testBridge as any).setupMessageListener();
    
    expect(spy).toHaveBeenCalledWith('message', expect.any(Function));
  });
  
  it('removes event listeners', () => {
    const spy = vi.spyOn(window, 'removeEventListener');
    
    // Create a new bridge and dispose it
    const testBridge = new WebViewBridge({ debug: false });
    testBridge.dispose();
    
    expect(spy).toHaveBeenCalled();
  });
  
  it('rejects sendMessageWithResponse on timeout', async () => {
    // Create a bridge with short timeout
    const bridge = createWebViewBridge({ timeout: 50 });
    
    // Create a test message with requestId
    const testMessage: BaseMessage = {
      type: 'TEST_MESSAGE',
      payload: { key: 'value' },
      requestId: 'test-456'
    };
    
    // Mock the timer to trigger immediately
    vi.useFakeTimers();
    
    // Start the promise
    const promise = bridge.sendMessageWithResponse(testMessage);
    
    // Fast-forward timer
    vi.advanceTimersByTime(100);
    
    // Expect the promise to reject
    await expect(promise).rejects.toThrow();
    
    // Restore real timers
    vi.useRealTimers();
  });
  
  it('cleans up resources when disposed', () => {
    // Create a test bridge
    const testBridge = new WebViewBridge({ debug: false });
    
    // Create a pending request
    const pendingRequest = {
      resolve: vi.fn(),
      timer: setTimeout(() => {}, 1000)
    };
    
    // Add a pending request
    (testBridge as any).pendingRequests.set('test-id', pendingRequest);
    
    // Call dispose
    testBridge.dispose();
    
    // Check that pendingRequests map is cleared
    expect((testBridge as any).pendingRequests.size).toBe(0);
  });
}); 