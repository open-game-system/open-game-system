import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isOGSWebView, getDeviceId, onDeviceIdChange, getBridge } from './core';

describe('Notification Kit Core (Bridge-backed)', () => {
  beforeEach(() => {
    // Reset the bridge singleton for each test
    // Since we can't easily reset the bridge singleton in code without adding a reset helper,
    // we mock the ReactNativeWebView and re-initialize
    vi.stubGlobal('ReactNativeWebView', {
      postMessage: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isOGSWebView', () => {
    it('returns true when ReactNativeWebView is present', () => {
      expect(isOGSWebView()).toBe(true);
    });

    it('returns false when ReactNativeWebView is missing', () => {
      vi.stubGlobal('ReactNativeWebView', undefined);
      expect(isOGSWebView()).toBe(false);
    });
  });

  describe('getDeviceId', () => {
    it('returns null if system store is not initialized', () => {
      // Bridge exists but no STATE_INIT message yet
      expect(getDeviceId()).toBe(null);
    });

    it('returns device id from bridge state', () => {
      const bridge = getBridge();

      // Simulate native sending STATE_INIT
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'STATE_INIT',
          storeKey: 'system',
          data: { ogsDeviceId: 'test-bridge-id' }
        })
      }));

      expect(getDeviceId()).toBe('test-bridge-id');
    });
  });

  describe('onDeviceIdChange', () => {
    it('subscribes to system store changes', () => {
      let latestId: string | null = null;
      onDeviceIdChange((id) => { latestId = id; });

      // Trigger update via message
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'STATE_INIT', // First time init
          storeKey: 'system',
          data: { ogsDeviceId: 'id-1' }
        })
      }));
      expect(latestId).toBe('id-1');

      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'STATE_UPDATE',
          storeKey: 'system',
          data: { ogsDeviceId: 'id-2' }
        })
      }));
      expect(latestId).toBe('id-2');
    });
  });
});
