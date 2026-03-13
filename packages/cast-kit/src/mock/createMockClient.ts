/**
 * Mock client creation for testing purposes
 */
import { CastClient } from '../client/core/client';
import { CastState, CastDevice, CastError, SignalReadyParams, CastOptions } from '../client/core/types';

/**
 * Log message format
 */
interface LogMessage {
  timestamp: number;
  type: string;
  message: string;
  data?: unknown;
}

/**
 * Options for creating a mock client
 */
export interface MockClientOptions {
  /**
   * Initial state of the mock client
   */
  initialState?: Partial<CastState>;
  
  /**
   * Whether to log mock client actions
   */
  debug?: boolean;
}

/**
 * Creates a mock CastClient for testing purposes
 */
export function createMockClient(options: MockClientOptions = {}): CastClient {
  // Create initial state with defaults
  const initialState: CastState = {
    isAvailable: true,
    isCasting: false,
    isConnecting: false,
    isScanning: false,
    deviceName: null,
    deviceId: null,
    sessionId: null,
    devices: [],
    error: null,
    ...options.initialState
  };
  
  // Current state
  let state = { ...initialState };
  
  // Listeners
  const listeners: Array<(state: CastState) => void> = [];
  
  // Logs
  const logs: LogMessage[] = [];
  
  // Log a message if debug is enabled
  const log = (type: string, message: string, data?: unknown) => {
    if (options.debug) {
      console.log(`[MockCastKit] [${type}] ${message}`, data);
    }
    
    logs.push({
      timestamp: Date.now(),
      type,
      message,
      data: data ?? {}
    });
  };
  
  // Notify all listeners of state change
  const notifyListeners = () => {
    for (const listener of listeners) {
      listener({ ...state });
    }
  };
  
  // Set state and notify listeners
  const setState = (newState: Partial<CastState>) => {
    state = { ...state, ...newState };
    notifyListeners();
  };
  
  // Simulate an error
  const _setError = (code: string, message: string, details?: Record<string, unknown>) => {
    const error: CastError = { code, message, details };
    setState({ error });
    log('ERROR', message, error);
  };
  
  // Create the mock client
  const client: CastClient = {
    // State management
    getState: () => ({ ...state }),
    
    subscribe: (listener) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };
    },
    
    // Core functionality
    signalReady: async (params: SignalReadyParams) => {
      log('INFO', 'Signaling ready', params);
      setState({ isAvailable: true });
    },
    
    scanForDevices: async () => {
      log('INFO', 'Scanning for devices');
      setState({ isScanning: true });
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Simulate finding devices
      const devices: CastDevice[] = [
        { id: 'mock-device-1', name: 'Mock TV 1', type: 'chromecast', isConnected: false },
        { id: 'mock-device-2', name: 'Mock TV 2', type: 'chromecast', isConnected: false }
      ];
      
      setState({
        devices,
        isScanning: false
      });
      
      log('INFO', 'Devices found', devices);
    },
    
    startCasting: async (deviceId: string, options: CastOptions = {}) => {
      log('INFO', 'Starting casting', { deviceId, options });
      setState({ 
        isConnecting: true,
        isCasting: false
      });
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Success case
      const device = state.devices.find(d => d.id === deviceId);
      
      setState({
        isConnecting: false,
        isCasting: true,
        deviceId,
        deviceName: device?.name || 'Unknown Device',
        sessionId: `mock-session-${Date.now()}`
      });
      
      log('INFO', 'Casting started', { deviceId, deviceName: state.deviceName });
    },
    
    stopCasting: async () => {
      log('INFO', 'Stopping casting');
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setState({
        isCasting: false,
        deviceName: null,
        deviceId: null,
        sessionId: null
      });
      
      log('INFO', 'Casting stopped');
    },
    
    sendStateUpdate: async (stateUpdate: Record<string, unknown>) => {
      log('INFO', 'Sending state update', stateUpdate);
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      log('INFO', 'State update sent');
    },
    
    resetError: () => {
      setState({ error: null });
      log('INFO', 'Error reset');
    },
    
    getLogs: () => [...logs]
  };
  
  return client;
}

/**
 * Example of how to use the mock client with the React context
 * 
 * ```typescript
 * import { CastKitContext } from '../react/context';
 * import { render } from '@testing-library/react';
 * 
 * // Create a mock client
 * const mockClient = createMockClient({
 *   initialState: {
 *     devices: [
 *       { id: 'test-device', name: 'Test TV', type: 'chromecast', isConnected: false }
 *     ]
 *   },
 *   debug: true
 * });
 * 
 * // Render your component with the mock client
 * render(
 *   <CastKitContext.ProviderFromClient client={mockClient}>
 *     <YourComponent />
 *   </CastKitContext.ProviderFromClient>
 * );
 * 
 * // You can also manipulate state for testing
 * mockClient.startCasting('test-device').then(() => {
 *   console.log('Mock casting started');
 * });
 * ```
 */ 