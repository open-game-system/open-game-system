/**
 * Cast Kit Receiver API
 * 
 * This module implements the receiver API for Cast Kit, allowing 
 * TV/broadcast applications to receive and handle cast sessions.
 */

/**
 * Get game parameters from the URL 
 */
export function getGameParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(window.location.search);
  
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  return params;
}

/**
 * The possible statuses of a receiver
 */
export type ReceiverStatus = 
  | 'initializing' 
  | 'ready'
  | 'connected'
  | 'disconnected'
  | 'error';

/**
 * Receiver state interface
 */
export interface ReceiverState {
  /** Current status of the receiver */
  status: ReceiverStatus;
  
  /** Error message if status is 'error' */
  error?: string;
  
  /** Current game state if any */
  gameState?: Record<string, unknown>;
}

/**
 * Callback function for receiver status updates
 */
export type ReceiverCallback = (state: ReceiverState) => void;

/**
 * Receiver options
 */
export interface ReceiverOptions {
  /** Enable debug mode */
  debug?: boolean;
  
  /** Callback for state updates */
  onStateChange?: ReceiverCallback;
}

/**
 * Receiver interface
 */
export interface Receiver {
  /** Get the current state */
  getState(): ReceiverState;
  
  /** Subscribe to state changes */
  subscribe(callback: ReceiverCallback): () => void;
}

/**
 * Cast Kit Receiver implementation
 */
class CastKitReceiver implements Receiver {
  private state: ReceiverState;
  private callbacks: ReceiverCallback[] = [];
  private debug: boolean;
  
  constructor(options: ReceiverOptions = {}) {
    this.debug = options.debug || false;
    
    // Initialize state
    this.state = {
      status: 'initializing'
    };
    
    // Add callback if provided
    if (options.onStateChange) {
      this.callbacks.push(options.onStateChange);
    }
    
    this.log('Receiver initialized');
    
    // Simulate initialization and ready state for demo
    setTimeout(() => {
      this.updateState({
        status: 'ready'
      });
    }, 500);
    
    // Listen for cast messages from the OpenGame SDK
    this.setupMessageHandlers();
  }
  
  /**
   * Get the current state
   */
  public getState(): ReceiverState {
    return { ...this.state };
  }
  
  /**
   * Subscribe to state changes
   */
  public subscribe(callback: ReceiverCallback): () => void {
    this.callbacks.push(callback);
    
    // Call immediately with current state
    callback(this.getState());
    
    // Return unsubscribe function
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Update the receiver state
   */
  private updateState(newState: Partial<ReceiverState>): void {
    this.state = {
      ...this.state,
      ...newState
    };
    
    this.notifyCallbacks();
  }
  
  /**
   * Notify all callbacks of state change
   */
  private notifyCallbacks(): void {
    for (const callback of this.callbacks) {
      try {
        callback(this.getState());
      } catch (error) {
        this.log('Error in callback', error);
      }
    }
  }
  
  /**
   * Log message if debug is enabled
   */
  private log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log(`[CastKit Receiver] ${message}`, data);
    }
  }
  
  /**
   * Set up message handlers for broadcast-controller communication
   */
  private setupMessageHandlers(): void {
    // Set up handlers for messages from the OpenGame SDK
    // or other casting technologies
    
    window.addEventListener('message', (event) => {
      try {
        const data = typeof event.data === 'string' 
          ? JSON.parse(event.data) 
          : event.data;
          
        if (!data || !data.type) {
          return;
        }
        
        this.log('Received message', data);
        
        switch (data.type) {
          case 'CAST_CONNECT':
            this.handleConnect(data);
            break;
            
          case 'CAST_DISCONNECT':
            this.handleDisconnect(data);
            break;
            
          case 'CAST_STATE_UPDATE':
            this.handleStateUpdate(data);
            break;
        }
      } catch (error) {
        this.log('Error processing message', error);
      }
    });
  }
  
  /**
   * Handle connection messages
   */
  private handleConnect(data: Record<string, unknown>): void {
    this.log('Controller connected', data);
    
    this.updateState({
      status: 'connected',
      gameState: data.initialState as Record<string, unknown> || {}
    });
  }
  
  /**
   * Handle disconnection messages
   */
  private handleDisconnect(data: Record<string, unknown>): void {
    this.log('Controller disconnected', data);
    
    this.updateState({
      status: 'disconnected'
    });
  }
  
  /**
   * Handle state update messages
   */
  private handleStateUpdate(data: Record<string, unknown>): void {
    this.log('State update received', data);
    
    if (data.state) {
      this.updateState({
        gameState: {
          ...this.state.gameState,
          ...(data.state as Record<string, unknown>)
        }
      });
    }
  }
}

/**
 * Initialize the receiver
 */
export function initReceiver(options: ReceiverOptions = {}): Receiver {
  return new CastKitReceiver(options);
} 