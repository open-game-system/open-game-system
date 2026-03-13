/**
 * Core client types for Cast Kit
 */

/**
 * Cast device representation
 */
export interface CastDevice {
  /**
   * Unique identifier for the device
   */
  id: string;
  
  /**
   * Human-readable name of the device
   */
  name: string;
  
  /**
   * Type of device (e.g., 'chromecast')
   */
  type: string;
  
  /**
   * Whether the device is currently connected
   */
  isConnected: boolean;
}

/**
 * Cast session status
 */
export type CastSessionStatus = 'connecting' | 'connected' | 'terminated' | 'error';

/**
 * Cast session representation
 */
export interface CastSession {
  /**
   * Unique identifier for the session
   */
  sessionId: string;
  
  /**
   * Current status of the session
   */
  status: CastSessionStatus;
  
  /**
   * ID of the device being cast to
   */
  deviceId: string;
  
  /**
   * Name of the device being cast to
   */
  deviceName: string;
  
  /**
   * Creation timestamp
   */
  createdAt: number;
  
  /**
   * Error message if status is 'error'
   */
  error?: string;
}

/**
 * Cast error representation
 */
export interface CastError {
  /**
   * Error code
   */
  code: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Additional error details
   */
  details?: Record<string, unknown>;
}

/**
 * Cast state
 */
export interface CastState {
  /**
   * Whether Cast SDK is available
   */
  isAvailable: boolean;
  
  /**
   * Whether a cast session is active
   */
  isCasting: boolean;
  
  /**
   * Whether a cast session is connecting
   */
  isConnecting: boolean;
  
  /**
   * Whether the client is scanning for devices
   */
  isScanning: boolean;
  
  /**
   * Name of the connected device (if any)
   */
  deviceName: string | null;
  
  /**
   * ID of the connected device (if any)
   */
  deviceId: string | null;
  
  /**
   * Current session ID (if any)
   */
  sessionId: string | null;
  
  /**
   * List of available cast devices
   */
  devices: CastDevice[];
  
  /**
   * Current error (if any)
   */
  error: CastError | null;
}

/**
 * Parameters for signalReady method
 */
export interface SignalReadyParams {
  /**
   * Game identifier
   */
  gameId: string;
  
  /**
   * Room code (if applicable)
   */
  roomCode?: string;
  
  /**
   * URL to broadcast to the TV
   */
  broadcastUrl?: string;
  
  /**
   * List of game capabilities
   */
  capabilities?: string[];
}

/**
 * Options for starting a cast session
 */
export interface CastOptions {
  /**
   * Initial state to send to the cast session
   */
  initialState?: Record<string, unknown>;
}

/**
 * Cast Kit client options
 */
export interface CastClientOptions {
  /**
   * Debug mode
   */
  debug?: boolean;
}

/**
 * Cast Kit Client interface
 */
export interface CastClient {
  /**
   * Get the current state
   */
  getState(): CastState;
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: CastState) => void): () => void;
  
  /**
   * Signal that the game is ready to cast
   */
  signalReady(params: SignalReadyParams): Promise<void>;
  
  /**
   * Scan for available cast devices
   */
  scanForDevices(): Promise<void>;
  
  /**
   * Start casting to a device
   */
  startCasting(deviceId: string, options?: CastOptions): Promise<void>;
  
  /**
   * Stop the current casting session
   */
  stopCasting(): Promise<void>;
  
  /**
   * Send a state update to the cast session
   */
  sendStateUpdate(state: Record<string, unknown>): Promise<void>;
  
  /**
   * Reset any error in the current state
   */
  resetError(): void;
  
  /**
   * Get the list of debug logs (if debug mode is enabled)
   */
  getLogs(): Array<{timestamp: number, type: string, message: string, data?: unknown}>;
} 