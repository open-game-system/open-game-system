/**
 * Cast Kit Client Implementation
 * 
 * This module provides the main client implementation for the Cast Kit library.
 */
import {
  createMessage,
  CastReadyMessage, 
  CastScanDevicesMessage,
  CastStartSessionMessage,
  CastEndSessionMessage,
  CastStateUpdateMessage,
} from '../bridge/protocol';
import { createWebViewBridge, isInOpenGameApp } from '../bridge/webview-bridge';
import type { Bridge } from '../bridge/webview-bridge';
import { 
  StateManager, 
  initialState 
} from './state';
import {
  CastState,
  CastClientOptions,
  SignalReadyParams,
  CastOptions,
  CastError,
  CastClient
} from './types';

// Export the CastClientOptions type for external use
export type { CastClientOptions, CastClient };

/**
 * Default client options
 */
const DEFAULT_OPTIONS: CastClientOptions = {
  debug: false,
};

// Create a type that ensures CastState can be used with StateManager
type ManagedCastState = CastState;

/**
 * Cast Kit Client implementation
 */
export class CastKitClient implements CastClient {
  private bridge: Bridge;
  private stateManager: StateManager<ManagedCastState>;
  private logs: Array<{timestamp: number, type: string, message: string, data?: unknown}> = [];
  private options: Required<CastClientOptions>;
  
  constructor(options: CastClientOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options } as Required<CastClientOptions>;
    
    // Initialize the bridge
    this.bridge = createWebViewBridge({
      debug: this.options.debug,
    });
    
    // Initialize the state manager
    this.stateManager = new StateManager<ManagedCastState>(initialState as unknown as ManagedCastState);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Log initialization
    this.log('info', 'CastKitClient initialized', { 
      options: this.options,
      isInOpenGameApp: isInOpenGameApp(),
    });
  }
  
  /**
   * Get the current state
   */
  public getState(): CastState {
    return this.stateManager.getState();
  }
  
  /**
   * Subscribe to state changes
   */
  public subscribe(listener: (state: CastState) => void): () => void {
    return this.stateManager.subscribe(listener as (state: ManagedCastState) => void);
  }
  
  /**
   * Signal that the game is ready to cast
   */
  public async signalReady(params: SignalReadyParams): Promise<void> {
    this.log('info', 'Signaling ready to cast', params);
    
    try {
      // Create the ready message
      const message: CastReadyMessage = createMessage({
        type: 'CAST_READY',
        payload: {
          gameId: params.gameId,
          roomCode: params.roomCode,
          broadcastUrl: params.broadcastUrl,
          capabilities: params.capabilities,
        },
      });
      
      // Send the message
      const response = await this.bridge.sendMessageWithResponse(message);
      
      // Handle the response
      this.log('info', 'Cast availability', { available: response.payload?.available });
      
      // Update state
      this.stateManager.setState({
        isAvailable: response.payload?.available ?? false,
        devices: response.payload?.devices || [],
      });
    } catch (error) {
      this.handleError('Failed to signal readiness', error);
      throw error;
    }
  }
  
  /**
   * Scan for available cast devices
   */
  public async scanForDevices(): Promise<void> {
    this.log('info', 'Scanning for cast devices');
    
    // Update state
    this.stateManager.setState({ isScanning: true });
    
    try {
      // Create the scan message
      const message: CastScanDevicesMessage = createMessage({
        type: 'CAST_SCAN_DEVICES',
        payload: {},
      });
      
      // Send the message
      await this.bridge.sendMessageWithResponse(message);
      
      // Note: Devices will be updated through event listeners
    } catch (error) {
      // Update state
      this.stateManager.setState({ isScanning: false });
      
      this.handleError('Failed to scan for devices', error);
      throw error;
    }
  }
  
  /**
   * Start casting to a device
   */
  public async startCasting(deviceId: string, options: CastOptions = {}): Promise<void> {
    this.log('info', 'Starting cast session', { deviceId, options });
    
    // Update state
    this.stateManager.setState({
      isConnecting: true,
      deviceId,
    });
    
    try {
      // Create the start session message
      const message: CastStartSessionMessage = createMessage({
        type: 'CAST_START_SESSION',
        payload: {
          deviceId,
          initialState: options.initialState || {},
        },
      });
      
      // Send the message
      await this.bridge.sendMessageWithResponse(message);
      
      // Note: Session status will be updated through event listeners
    } catch (error) {
      // Update state
      this.stateManager.setState({
        isConnecting: false,
        deviceId: null,
      });
      
      this.handleError('Failed to start casting', error);
      throw error;
    }
  }
  
  /**
   * Stop the current cast session
   */
  public async stopCasting(): Promise<void> {
    const { sessionId } = this.stateManager.getState();
    
    if (!sessionId) {
      this.log('warn', 'No active cast session to stop');
      return;
    }
    
    this.log('info', 'Stopping cast session', { sessionId });
    
    try {
      // Create the end session message
      const message: CastEndSessionMessage = createMessage({
        type: 'CAST_END_SESSION',
        payload: {},
      });
      
      // Send the message
      await this.bridge.sendMessageWithResponse(message);
      
      // Update state immediately
      this.stateManager.setState({
        isCasting: false,
        isConnecting: false,
        deviceId: null,
        deviceName: null,
        sessionId: null,
      });
      
      // Note: Session status will also be updated through event listeners
    } catch (error) {
      this.handleError('Failed to stop casting', error);
      throw error;
    }
  }
  
  /**
   * Send a state update to the cast session
   */
  public async sendStateUpdate(state: Record<string, unknown>): Promise<void> {
    const { sessionId } = this.stateManager.getState();
    
    if (!sessionId) {
      this.log('warn', 'No active cast session to update');
      throw new Error('No active cast session');
    }
    
    this.log('info', 'Sending state update', { sessionId });
    
    try {
      // Create the message
      const message: CastStateUpdateMessage = createMessage({
        type: 'CAST_STATE_UPDATE',
        payload: {
          state,
          timestamp: Date.now(),
        },
      });
      
      // Send the message
      await this.bridge.sendMessageWithResponse(message);
    } catch (error) {
      this.handleError('Failed to send state update', error);
      throw error;
    }
  }
  
  /**
   * Reset any error in the current state
   */
  public resetError(): void {
    this.stateManager.setState({ error: null });
  }
  
  /**
   * Get the list of debug logs (if debug mode is enabled)
   */
  public getLogs(): Array<{timestamp: number, type: string, message: string, data?: unknown}> {
    return [...this.logs];
  }
  
  /**
   * Set up event listeners for bridge communication
   */
  private setupEventListeners(): void {
    this.bridge.addEventListener('message', (event: Event) => {
      const messageEvent = event as MessageEvent;
      const message = messageEvent.data;
      
      // Ignore invalid messages
      if (!message || !message.type) return;
      
      switch (message.type) {
        case 'CAST_DEVICES_UPDATED':
          this.log('info', 'Devices updated', message.payload);
          
          // Update state with devices
          this.stateManager.setState({
            isScanning: false,
            devices: message.payload.devices || [],
          });
          break;
          
        case 'CAST_SESSION_UPDATED':
          this.log('info', 'Session updated', message.payload);
          
          // Handle different session statuses
          if (message.payload.status === 'connected') {
            // Update state for connected session
            this.stateManager.setState({
              isConnecting: false,
              isCasting: true,
              deviceId: message.payload.deviceId,
              deviceName: message.payload.deviceName,
              sessionId: message.payload.sessionId,
            });
          } else if (message.payload.status === 'terminated') {
            // Update state for terminated session
            this.stateManager.setState({
              isCasting: false,
              isConnecting: false,
              deviceId: null,
              deviceName: null,
              sessionId: null,
            });
          } else if (message.payload.status === 'error') {
            // Update state for error
            this.stateManager.setState({
              isCasting: false,
              isConnecting: false,
              deviceId: null,
              deviceName: null,
              sessionId: null,
              error: {
                code: 'SESSION_ERROR',
                message: message.payload.error || 'Session error',
              },
            });
          }
          break;
          
        case 'CAST_ERROR':
          this.log('error', 'Error from cast service', message.payload);
          
          // Update state with error
          this.stateManager.setState({
            error: {
              code: message.payload.code,
              message: message.payload.message,
              details: message.payload.details,
            },
          });
          break;
      }
    });
  }
  
  /**
   * Handle errors from the bridge
   */
  private handleError(message: string, error: unknown): void {
    this.log('error', message, error);
    
    // Create cast error
    const castError: CastError = {
      code: 'BRIDGE_ERROR',
      message: message,
      details: { originalError: error },
    };
    
    // Update state with error
    this.stateManager.setState({ error: castError });
  }
  
  /**
   * Log a message if debug is enabled
   */
  private log(type: string, message: string, data?: unknown): void {
    if (this.options.debug) {
      console.log(`CastKit [${type.toUpperCase()}]:`, message, data);
    }
    
    // Add to logs
    this.logs.push({
      timestamp: Date.now(),
      type,
      message,
      data,
    });
  }
}

/**
 * Create a Cast Kit client
 */
export function createCastClient(options: CastClientOptions = {}): CastClient {
  return new CastKitClient(options);
} 