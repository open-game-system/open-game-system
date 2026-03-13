/**
 * Cast Kit - Mock Implementation
 * 
 * This module provides mock implementations for testing and development.
 */

import { 
    CastClient, 
    CastState,
    SignalReadyParams, 
    CastOptions
} from '../client';

/**
 * Mock client extensions for testing
 */
export interface MockClientExtensions {
    _mock: {
        /**
         * Set the state directly
         */
        setState(newState: Partial<CastState>): void;
        
        /**
         * Get method call history
         */
        getMethodCalls(method?: string): Record<string, unknown[]>;
        
        /**
         * Clear method call history
         */
        clearMethodCalls(): void;
    };
}

/**
 * Options for the mock client
 */
export interface MockClientOptions {
    /**
     * Initial state
     */
    initialState?: Partial<CastState>;
    
    /**
     * Method that should simulate an error
     */
    simulateError?: 'signalReady' | 'scanForDevices' | 'startCasting' | 'stopCasting' | 'sendStateUpdate';
    
    /**
     * Delay for responses in ms
     * @default 0
     */
    delay?: number;
}

/**
 * Create a mock client for testing
 */
export function createMockCastClient(options: MockClientOptions = {}): CastClient & MockClientExtensions {
    // Create initial state by merging defaults with provided options
    const initialState: CastState = {
        isAvailable: true,
        isCasting: false,
        isConnecting: false,
        isScanning: false,
        deviceName: null,
        deviceId: null,
        sessionId: null,
        error: null,
        devices: [
            { id: 'device-1', name: 'Living Room TV', type: 'chromecast', isConnected: false },
            { id: 'device-2', name: 'Bedroom TV', type: 'chromecast', isConnected: false }
        ],
        ...options.initialState
    };
    
    // Track method calls for testing
    const methodCalls: Record<string, unknown[]> = {
        signalReady: [],
        scanForDevices: [],
        startCasting: [],
        stopCasting: [],
        sendStateUpdate: [],
        resetError: [],
        subscribe: [],
        getState: []
    };
    
    // Create listeners array
    const listeners: Array<(state: CastState) => void> = [];
    
    // Debug logs
    const logs: Array<{timestamp: number, type: string, message: string, data?: unknown}> = [];
    
    // Current state
    let state = { ...initialState };
    
    /**
     * Notify listeners of state change
     */
    const notifyListeners = () => {
        for (const listener of listeners) {
            listener({ ...state });
        }
    };
    
    /**
     * Track a method call
     */
    const trackMethodCall = (method: string, ...args: unknown[]) => {
        if (!methodCalls[method]) {
            methodCalls[method] = [];
        }
        methodCalls[method].push(args);
    };
    
    /**
     * Log a message
     */
    const log = (type: string, message: string, data?: unknown) => {
        logs.push({
            timestamp: Date.now(),
            type,
            message,
            data
        });
    };
    
    /**
     * Simulate a delay
     */
    const delay = (ms: number = options.delay || 0) => {
        if (ms === 0) return Promise.resolve();
        return new Promise(resolve => setTimeout(resolve, ms));
    };
    
    /**
     * Create the mock client
     */
    const client: CastClient & MockClientExtensions = {
        getState: () => {
            trackMethodCall('getState');
            return { ...state };
        },
        
        subscribe: (listener) => {
            trackMethodCall('subscribe', listener);
            listeners.push(listener);
            
            return () => {
                const index = listeners.indexOf(listener);
                if (index !== -1) {
                    listeners.splice(index, 1);
                }
            };
        },
        
        signalReady: async (params: SignalReadyParams) => {
            trackMethodCall('signalReady', params);
            log('info', 'Signal ready', params);
            
            await delay();
            
            if (options.simulateError === 'signalReady') {
                const error = new Error('Simulated signalReady error');
                log('error', 'Signal ready failed', error);
                throw error;
            }
            
            state = {
                ...state,
                isAvailable: true
            };
            
            notifyListeners();
        },
        
        scanForDevices: async () => {
            trackMethodCall('scanForDevices');
            log('info', 'Scanning for devices');
            
            state = {
                ...state,
                isScanning: true
            };
            
            notifyListeners();
            
            await delay();
            
            if (options.simulateError === 'scanForDevices') {
                state = {
                    ...state,
                    isScanning: false,
                    error: {
                        code: 'SCAN_ERROR',
                        message: 'Simulated scanForDevices error'
                    }
                };
                
                notifyListeners();
                
                log('error', 'Scan for devices failed');
                throw new Error('Simulated scanForDevices error');
            }
            
            state = {
                ...state,
                isScanning: false
            };
            
            notifyListeners();
        },
        
        startCasting: async (deviceId: string, castOptions: CastOptions = {}) => {
            trackMethodCall('startCasting', deviceId, castOptions);
            log('info', 'Start casting', { deviceId, options: castOptions });
            
            // Find the device
            const device = state.devices.find(d => d.id === deviceId);
            
            if (!device) {
                log('error', 'Device not found', { deviceId });
                throw new Error(`Device with ID ${deviceId} not found`);
            }
            
            state = {
                ...state,
                isConnecting: true,
                deviceId,
                deviceName: device.name
            };
            
            notifyListeners();
            
            await delay();
            
            if (options.simulateError === 'startCasting') {
                state = {
                    ...state,
                    isConnecting: false,
                    deviceId: null,
                    deviceName: null,
                    error: {
                        code: 'CAST_ERROR',
                        message: 'Simulated startCasting error'
                    }
                };
                
                notifyListeners();
                
                log('error', 'Start casting failed');
                throw new Error('Simulated startCasting error');
            }
            
            state = {
                ...state,
                isCasting: true,
                isConnecting: false,
                sessionId: `session-${Date.now()}`,
                devices: state.devices.map(d => 
                    d.id === deviceId 
                        ? { ...d, isConnected: true } 
                        : d
                )
            };
            
            notifyListeners();
        },
        
        stopCasting: async () => {
            trackMethodCall('stopCasting');
            log('info', 'Stop casting');
            
            if (!state.sessionId) {
                log('warn', 'No active session to stop');
                return;
            }
            
            await delay();
            
            if (options.simulateError === 'stopCasting') {
                state = {
                    ...state,
                    error: {
                        code: 'STOP_ERROR',
                        message: 'Simulated stopCasting error'
                    }
                };
                
                notifyListeners();
                
                log('error', 'Stop casting failed');
                throw new Error('Simulated stopCasting error');
            }
            
            const deviceId = state.deviceId;
            
            state = {
                ...state,
                isCasting: false,
                isConnecting: false,
                deviceId: null,
                deviceName: null,
                sessionId: null,
                devices: state.devices.map(d => 
                    d.id === deviceId 
                        ? { ...d, isConnected: false } 
                        : d
                )
            };
            
            notifyListeners();
        },
        
        sendStateUpdate: async (stateData: Record<string, unknown>) => {
            trackMethodCall('sendStateUpdate', stateData);
            log('info', 'Send state update', stateData);
            
            if (!state.sessionId) {
                log('error', 'No active session to update');
                throw new Error('No active cast session');
            }
            
            await delay();
            
            if (options.simulateError === 'sendStateUpdate') {
                state = {
                    ...state,
                    error: {
                        code: 'UPDATE_ERROR',
                        message: 'Simulated sendStateUpdate error'
                    }
                };
                
                notifyListeners();
                
                log('error', 'Send state update failed');
                throw new Error('Simulated sendStateUpdate error');
            }
        },
        
        resetError: () => {
            trackMethodCall('resetError');
            log('info', 'Reset error');
            
            state = {
                ...state,
                error: null
            };
            
            notifyListeners();
        },
        
        getLogs: () => {
            return [...logs];
        },
        
        // Mock extensions
        _mock: {
            setState: (newState: Partial<CastState>) => {
                state = {
                    ...state,
                    ...newState
                };
                
                notifyListeners();
            },
            
            getMethodCalls: (method?: string) => {
                if (method) {
                    // Create a record with just this method
                    return { [method]: methodCalls[method] || [] } as Record<string, unknown[]>;
                }
                
                // Return all method calls
                return { ...methodCalls };
            },
            
            clearMethodCalls: () => {
                for (const key of Object.keys(methodCalls)) {
                    methodCalls[key] = [];
                }
            }
        }
    };
    
    return client;
} 