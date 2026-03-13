/**
 * Bridge types
 * 
 * This module provides the type definitions for bridge implementations.
 */

import { BaseMessage } from './protocol';

/**
 * Bridge interface for communication
 */
export interface Bridge {
  /**
   * Send a message through the bridge
   */
  sendMessage(message: BaseMessage): void | Promise<void>;
  
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
  
  /**
   * Clean up resources when the bridge is no longer needed
   */
  dispose(): void;
}

/**
 * Extended bridge interface with session management
 */
export interface SessionBridge extends Bridge {
  /**
   * Get the session ID
   */
  getSessionId(): string | null;
  
  /**
   * Terminate the session
   */
  terminateSession(): Promise<void>;
} 