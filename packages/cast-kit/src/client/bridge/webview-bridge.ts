/**
 * WebView Bridge implementation
 * 
 * This module provides the bridge implementation for communicating
 * with the native OpenGame App via WebView postMessage.
 */

import { BaseMessage, validateMessage } from './protocol';

/**
 * Bridge interface for communication
 */
export interface Bridge {
  /**
   * Send a message through the bridge
   */
  sendMessage(message: BaseMessage): void;
  
  /**
   * Send a message and wait for a response
   */
  sendMessageWithResponse<T extends BaseMessage>(message: BaseMessage, timeout?: number): Promise<T>;
  
  /**
   * Add an event listener for incoming messages
   */
  addEventListener(type: string, listener: EventListener): void;
  
  /**
   * Remove an event listener
   */
  removeEventListener(type: string, listener: EventListener): void;
}

/**
 * Options for creating a WebView bridge
 */
export interface WebViewBridgeOptions {
  /**
   * Target origin for postMessage
   * @default '*'
   */
  targetOrigin?: string;
  
  /**
   * Timeout for sendMessageWithResponse in milliseconds
   * @default 5000
   */
  timeout?: number;
  
  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Default options for WebView bridge
 */
const DEFAULT_OPTIONS: WebViewBridgeOptions = {
  targetOrigin: '*',
  timeout: 5000,
  debug: false,
};

/**
 * Implementation of Bridge interface for WebView communication
 */
export class WebViewBridge implements Bridge {
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = new Map();
  
  private options: Required<WebViewBridgeOptions>;
  
  constructor(options: WebViewBridgeOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options } as Required<WebViewBridgeOptions>;
    
    // Setup message listener
    this.setupMessageListener();
  }
  
  /**
   * Send a message through the bridge
   */
  public sendMessage(message: BaseMessage): void {
    if (this.options.debug) {
      console.log('CastKit [SEND]:', message);
    }
    
    window.postMessage(message, this.options.targetOrigin);
  }
  
  /**
   * Send a message and wait for a response
   */
  public sendMessageWithResponse<T extends BaseMessage>(
    message: BaseMessage,
    timeout = this.options.timeout
  ): Promise<T> {
    if (!message.requestId) {
      throw new Error('Message must have a requestId for sendMessageWithResponse');
    }
    
    return new Promise<T>((resolve, reject) => {
      // Setup timeout
      const timer = setTimeout(() => {
        if (message.requestId) {
          this.pendingRequests.delete(message.requestId);
        }
        reject(new Error(`Request timed out after ${timeout}ms: ${message.type}`));
      }, timeout);
      
      // Store the pending request
      if (message.requestId) {
        this.pendingRequests.set(message.requestId, {
          resolve: resolve as (value: unknown) => void,
          reject,
          timer
        });
      } else {
        // If there's no requestId, reject immediately
        reject(new Error('Message missing requestId'));
      }
      
      // Send the message
      this.sendMessage(message);
    });
  }
  
  /**
   * Add an event listener for incoming messages
   */
  public addEventListener(type: string, listener: EventListener): void {
    window.addEventListener(type, listener);
  }
  
  /**
   * Remove an event listener
   */
  public removeEventListener(type: string, listener: EventListener): void {
    window.removeEventListener(type, listener);
  }
  
  /**
   * Setup the message listener for incoming messages
   */
  private setupMessageListener(): void {
    window.addEventListener('message', this.handleMessage as EventListener);
  }
  
  /**
   * Handle incoming messages
   */
  private handleMessage = (event: MessageEvent): void => {
    const message = event.data;
    
    // Check if the message is valid
    if (!validateMessage(message)) {
      if (this.options.debug) {
        console.warn('CastKit: Invalid message received', message);
      }
      return;
    }
    
    if (this.options.debug) {
      console.log('CastKit [RECV]:', message);
    }
    
    // If this is a response to a request, resolve the promise
    if (message.requestId && this.pendingRequests.has(message.requestId)) {
      const pendingRequest = this.pendingRequests.get(message.requestId);
      if (pendingRequest) {
        const { resolve, timer } = pendingRequest;
        
        // Clear the timeout
        clearTimeout(timer);
        
        // Remove from pending requests
        this.pendingRequests.delete(message.requestId);
        
        // Resolve with the response
        resolve(message.payload || {});
      }
    }
  };
  
  /**
   * Clean up resources when the bridge is no longer needed
   */
  public dispose(): void {
    // Remove event listener
    window.removeEventListener('message', this.handleMessage as EventListener);
    
    // Clear all pending requests
    for (const { timer, reject } of this.pendingRequests.values()) {
      clearTimeout(timer);
      reject(new Error('Bridge disposed'));
    }
    
    // Clear the map
    this.pendingRequests.clear();
  }
}

/**
 * Create a WebView bridge
 */
export function createWebViewBridge(options: WebViewBridgeOptions = {}): Bridge {
  return new WebViewBridge(options);
}

/**
 * Check if the code is running inside the OpenGame App
 */
export function isInOpenGameApp(): boolean {
  return typeof navigator !== 'undefined' && 
    navigator.userAgent.includes('OpenGame/');
} 