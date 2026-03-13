/**
 * Tests for the Cast Kit client implementation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createCastClient } from './client';
import type { CastClient } from './client';

// Mock the WebView bridge
vi.mock('../bridge/webview-bridge', () => {
  return {
    isInOpenGameApp: vi.fn().mockReturnValue(true),
    createWebViewBridge: vi.fn(() => ({
      addEventListener: (event: string, handler: (event: MessageEvent) => void) => {
        if (!eventListeners[event]) {
          eventListeners[event] = [];
        }
        eventListeners[event].push(handler);
      },
      removeEventListener: vi.fn(),
      sendMessageWithResponse: vi.fn().mockImplementation((message) => {
        if (message.type === 'CAST_READY') {
          return Promise.resolve({
            type: 'CAST_READY_RESPONSE',
            payload: {
              available: true,
              devices: [
                { id: 'device1', name: 'Test TV', type: 'chromecast', isConnected: false },
                { id: 'device2', name: 'Another TV', type: 'chromecast', isConnected: false }
              ]
            },
            requestId: message.requestId
          });
        } if (message.type === 'CAST_START_SESSION') {
          // Update event listeners directly to simulate a session update
          if (eventListeners.message) {
            const sessionUpdateEvent = new MessageEvent('message', {
              data: {
                type: 'CAST_SESSION_UPDATED',
                payload: {
                  status: 'connected',
                  deviceId: 'device1',
                  deviceName: 'Test TV',
                  sessionId: 'session-123',
                  error: null
                }
              }
            });
            
            for (const listener of eventListeners.message) {
              listener(sessionUpdateEvent);
            }
          }
          
          return Promise.resolve({
            type: 'CAST_START_SESSION_RESPONSE',
            payload: {
              success: true
            },
            requestId: message.requestId
          });
        } if (message.type === 'CAST_END_SESSION') {
          return Promise.resolve({
            type: 'CAST_END_SESSION_RESPONSE',
            payload: {
              success: true
            },
            requestId: message.requestId
          });
        } if (message.type === 'CAST_STATE_UPDATE') {
          return Promise.resolve({
            type: 'CAST_STATE_UPDATE_RESPONSE',
            payload: {
              success: true
            },
            requestId: message.requestId
          });
        } if (message.type === 'CAST_SCAN_DEVICES') {
          // Simulate devices update after scanning
          if (eventListeners.message) {
            const devicesEvent = new MessageEvent('message', {
              data: {
                type: 'CAST_DEVICES_UPDATED',
                payload: {
                  devices: [
                    { id: 'device1', name: 'Test TV', type: 'chromecast', isConnected: false },
                    { id: 'device2', name: 'Another TV', type: 'chromecast', isConnected: false }
                  ]
                }
              }
            });
            
            for (const listener of eventListeners.message) {
              listener(devicesEvent);
            }
          }
          
          return Promise.resolve({
            type: 'CAST_SCAN_DEVICES_RESPONSE',
            payload: {
              success: true
            },
            requestId: message.requestId
          });
        }
        
        return {
          type: `${message.type}_RESPONSE`,
          payload: {},
          requestId: message.requestId
        };
      })
    }))
  };
});

// Store event listeners
const eventListeners: Record<string, ((event: MessageEvent) => void)[]> = {};

describe('CastKitClient', () => {
  let client: CastClient;
  
  beforeEach(() => {
    // Clear event listeners
    for (const key of Object.keys(eventListeners)) {
      delete eventListeners[key];
    }
    
    // Create a new client for each test
    client = createCastClient({ debug: true });
  });
  
  afterEach(() => {
    // Cleanup
    client = null as any;
  });
  
  it('should initialize with default state', () => {
    const state = client.getState();
    expect(state.isAvailable).toBe(false);
    expect(state.isCasting).toBe(false);
    expect(state.devices).toEqual([]);
    expect(state.error).toBeNull();
  });
  
  it('should notify subscribers when state changes', () => {
    const listener = vi.fn();
    client.subscribe(listener);
    
    // Update state
    client.resetError();
    
    // Check that listener was called
    expect(listener).toHaveBeenCalled();
  });
  
  it('should signal readiness', async () => {
    await client.signalReady({
      gameId: 'test-game',
      roomCode: 'TEST123',
    });
    
    const state = client.getState();
    expect(state.isAvailable).toBe(true);
    expect(state.devices).toHaveLength(2);
  });
  
  it('should scan for devices', async () => {
    await client.scanForDevices();
    
    const state = client.getState();
    expect(state.devices).toHaveLength(2);
    expect(state.isScanning).toBe(false);
  });
  
  it('should start and stop casting', async () => {
    // First signal ready
    await client.signalReady({
      gameId: 'test-game',
      roomCode: 'TEST123',
    });
    
    // Start casting
    await client.startCasting('device1');
    
    // Check state
    let state = client.getState();
    expect(state.isCasting).toBe(true);
    expect(state.sessionId).toBe('session-123');
    expect(state.deviceId).toBe('device1');
    
    // Stop casting
    await client.stopCasting();
    
    // Check state
    state = client.getState();
    expect(state.isCasting).toBe(false);
    expect(state.sessionId).toBeNull();
  });
  
  it('should handle state updates', async () => {
    // First signal ready
    await client.signalReady({
      gameId: 'test-game',
      roomCode: 'TEST123',
    });
    
    // Start casting
    await client.startCasting('device1');
    
    // Send a state update
    await client.sendStateUpdate({ test: 'value' });
    
    // Stop casting to verify state handling
    await client.stopCasting();
    
    // Ensure no errors
    expect(client.getState().error).toBeNull();
  });
  
  it('should handle error messages', async () => {
    // First signal ready
    await client.signalReady({
      gameId: 'test-game',
      roomCode: 'TEST123',
    });
    
    // Simulate an error message
    if (eventListeners.message) {
      const errorEvent = new MessageEvent('message', {
        data: {
          type: 'CAST_ERROR',
          payload: {
            code: 'CONNECTION_ERROR',
            message: 'Failed to connect to device',
            details: { deviceId: 'device1' }
          }
        }
      });
      
      for (const listener of eventListeners.message) {
        listener(errorEvent);
      }
    }
    
    // Check that error was set
    const state = client.getState();
    expect(state.error).not.toBeNull();
    expect(state.error?.code).toBe('CONNECTION_ERROR');
  });
  
  it('should provide debug logs when requested', () => {
    const logs = client.getLogs();
    expect(logs).toHaveLength(1); // Initialization log
    expect(logs[0].type).toBe('info');
  });
  
  it('should handle no active session gracefully', async () => {
    // Try to stop casting without an active session
    await client.stopCasting();
    
    // Should not throw and state should be unchanged
    const state = client.getState();
    expect(state.error).toBeNull();
  });
  
  it('should handle sendStateUpdate with no active session', async () => {
    // Mock the cast client's sendMessageWithResponse method to bypass sessionId check
    const clientWithMock = client;
    const originalMethod = clientWithMock.bridge.sendMessageWithResponse;
    clientWithMock.bridge.sendMessageWithResponse = vi.fn().mockResolvedValue({
      type: 'CAST_STATE_UPDATE_RESPONSE',
      payload: { success: true }
    });
    
    // Expect an error when trying to update state without a session
    await expect(client.sendStateUpdate({ test: 'value' })).rejects.toThrow();
    
    // Restore original method
    clientWithMock.bridge.sendMessageWithResponse = originalMethod;
  });
}); 