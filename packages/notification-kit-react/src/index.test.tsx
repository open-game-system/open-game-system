import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { NotificationProvider, useNotifications } from './index';

describe('Notification React Hook (Bridge-backed)', () => {
  beforeEach(() => {
    vi.stubGlobal('ReactNativeWebView', {
      postMessage: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('provides default values when not in OGS app', () => {
    vi.stubGlobal('ReactNativeWebView', undefined);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NotificationProvider>{children}</NotificationProvider>
    );

    const { result } = renderHook(() => useNotifications(), { wrapper });

    expect(result.current.isInOGSApp).toBe(false);
    expect(result.current.isSupported).toBe(false);
    expect(result.current.deviceId).toBe(null);
  });

  // TODO: Fix — bridge subscription in NotificationProvider doesn't fire
  // in test environment. Needs investigation into createBridgeContext test harness.
  it.skip('reads device ID from bridge messages', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NotificationProvider>{children}</NotificationProvider>
    );

    const { result } = renderHook(() => useNotifications(), { wrapper });

    expect(result.current.isInOGSApp).toBe(true);
    expect(result.current.deviceId).toBe(null);

    // Simulate bridge STATE_INIT message
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'STATE_INIT',
          storeKey: 'system',
          data: { ogsDeviceId: 'hook-id-123' }
        })
      }));
    });

    await waitFor(() => {
      expect(result.current.deviceId).toBe('hook-id-123');
      expect(result.current.isSupported).toBe(true);
    });
  });
});
