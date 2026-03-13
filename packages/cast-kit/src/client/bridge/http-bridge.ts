/**
 * HTTP Bridge implementation
 * 
 * This module provides an HTTP bridge implementation for communicating
 * with the Cast Kit server using a RESTful API with optional Server-Sent Events
 * for streaming responses.
 */

import { BaseMessage, validateMessage } from './protocol';
import { SessionBridge } from './types';

/**
 * Options for creating an HTTP bridge
 */
export interface HttpBridgeOptions {
  /**
   * The base URL for the Cast Kit server
   */
  baseUrl: string;
  
  /**
   * Authentication token to use for requests
   */
  authToken?: string;
  
  /**
   * Timeout for requests in milliseconds
   * @default 30000
   */
  timeout?: number;
  
  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Default options for HTTP bridge
 */
const DEFAULT_OPTIONS: Partial<HttpBridgeOptions> = {
  timeout: 30000,
  debug: false,
};

/**
 * Implementation of Bridge interface for HTTP communication
 */
export class HttpBridge implements SessionBridge {
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = new Map();
  
  private options: Required<HttpBridgeOptions>;
  private sessionId: string | null = null;
  private eventSource: EventSource | null = null;
  private eventListeners: Map<string, Set<EventListener>> = new Map();
  private lastEventId: string | null = null;
  
  constructor(options: HttpBridgeOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options } as Required<HttpBridgeOptions>;
  }
  
  /**
   * Send a message through the bridge
   */
  public async sendMessage(message: BaseMessage): Promise<void> {
    if (this.options.debug) {
      console.log('CastKit [SEND]:', message);
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };
    
    // Add authentication if available
    if (this.options.authToken) {
      headers['Authorization'] = `Bearer ${this.options.authToken}`;
    }
    
    // Add session ID if available
    if (this.sessionId) {
      headers['Cast-Session-Id'] = this.sessionId;
    }
    
    try {
      const response = await fetch(`${this.options.baseUrl}/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify(message)
      });
      
      // Check if this is an SSE response
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('text/event-stream')) {
        this.handleSSEResponse(response, message.requestId);
      } else {
        // Process as a regular JSON response
        const data = await response.json();
        
        // Check for session ID in response headers
        const respSessionId = response.headers.get('Cast-Session-Id');
        if (respSessionId) {
          this.sessionId = respSessionId;
        }
        
        if (this.options.debug) {
          console.log('CastKit [RECV]:', data);
        }
        
        // If this is a response to a pending request, resolve it
        if (message.requestId && this.pendingRequests.has(message.requestId)) {
          const pendingRequest = this.pendingRequests.get(message.requestId);
          if (pendingRequest) {
            const { resolve, timer } = pendingRequest;
            
            // Clear the timeout
            clearTimeout(timer);
            
            // Remove from pending requests
            this.pendingRequests.delete(message.requestId);
            
            // Resolve with the response
            resolve(data);
          }
        }
        
        // Dispatch the message to any listeners
        this.dispatchEvent(new MessageEvent('message', { data }));
      }
    } catch (error) {
      console.error('CastKit [ERROR]:', error);
      
      // If this is a response to a pending request, reject it
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const pendingRequest = this.pendingRequests.get(message.requestId);
        if (pendingRequest) {
          const { reject, timer } = pendingRequest;
          
          // Clear the timeout
          clearTimeout(timer);
          
          // Remove from pending requests
          this.pendingRequests.delete(message.requestId);
          
          // Reject with the error
          reject(error);
        }
      }
    }
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
      this.pendingRequests.set(message.requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer
      });
      
      // Send the message
      this.sendMessage(message).catch(reject);
    });
  }
  
  /**
   * Add an event listener for incoming messages
   */
  public addEventListener(type: string, listener: EventListener): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.add(listener);
    }
    
    // If this is the first message listener, set up the SSE connection
    const messageListeners = this.eventListeners.get('message');
    if (type === 'message' && messageListeners && messageListeners.size === 1) {
      this.connectEventSource();
    }
  }
  
  /**
   * Remove an event listener
   */
  public removeEventListener(type: string, listener: EventListener): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
    
    // If this was the last message listener, close the SSE connection
    const messageListeners = this.eventListeners.get('message');
    if (type === 'message' && messageListeners && messageListeners.size === 0) {
      this.closeEventSource();
    }
  }
  
  /**
   * Dispatch an event to listeners
   */
  private dispatchEvent(event: Event): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
  
  /**
   * Handle an SSE response
   */
  private handleSSEResponse(response: Response, requestId?: string): void {
    const reader = response.body?.getReader();
    if (!reader) return;
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    // Process the stream
    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Convert the chunk to text and add to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete events in the buffer
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';
          
          for (const event of events) {
            const lines = event.split('\n');
            let eventData = '';
            let eventId = '';
            
            for (const line of lines) {
              if (line.startsWith('data:')) {
                eventData = line.slice(5).trim();
              } else if (line.startsWith('id:')) {
                eventId = line.slice(3).trim();
              }
            }
            
            if (eventData) {
              try {
                // Parse the event data
                const data = JSON.parse(eventData);
                
                // Update the last event ID for resumability
                if (eventId) {
                  this.lastEventId = eventId;
                }
                
                if (this.options.debug) {
                  console.log('CastKit [SSE]:', data);
                }
                
                // If this is a response to a pending request, resolve it
                if (requestId && this.pendingRequests.has(requestId) && data.id === requestId) {
                  const pendingRequest = this.pendingRequests.get(requestId);
                  if (pendingRequest) {
                    const { resolve, timer } = pendingRequest;
                    
                    // Clear the timeout
                    clearTimeout(timer);
                    
                    // Remove from pending requests
                    this.pendingRequests.delete(requestId);
                    
                    // Resolve with the response
                    resolve(data);
                  }
                }
                
                // Dispatch the message to any listeners
                this.dispatchEvent(new MessageEvent('message', { data }));
              } catch (error) {
                console.error('CastKit [SSE ERROR]:', error);
              }
            }
          }
        }
      } catch (error) {
        console.error('CastKit [STREAM ERROR]:', error);
      } finally {
        reader.releaseLock();
      }
    };
    
    processStream();
  }
  
  /**
   * Connect to the event source for server-sent events
   */
  private connectEventSource(): void {
    if (this.eventSource) {
      this.closeEventSource();
    }
    
    const headers: Record<string, string> = {};
    
    // Add authentication if available
    if (this.options.authToken) {
      headers['Authorization'] = `Bearer ${this.options.authToken}`;
    }
    
    // Add session ID if available
    if (this.sessionId) {
      headers['Cast-Session-Id'] = this.sessionId;
    }
    
    // Add last event ID for resumability
    if (this.lastEventId) {
      headers['Last-Event-Id'] = this.lastEventId;
    }
    
    // Create URL with headers as query parameters
    // (EventSource doesn't support custom headers, so we use query params)
    let url = `${this.options.baseUrl}/message`;
    const queryParams = new URLSearchParams();
    
    Object.entries(headers).forEach(([key, value]) => {
      queryParams.append(key, value);
    });
    
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    // Create the event source
    this.eventSource = new EventSource(url);
    
    // Listen for messages
    this.eventSource.onmessage = (event) => {
      if (event && typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data);
          
          if (this.options.debug) {
            console.log('CastKit [SSE]:', data);
          }
          
          // Update the last event ID
          if ('lastEventId' in event && typeof event.lastEventId === 'string') {
            this.lastEventId = event.lastEventId;
          }
          
          // Dispatch the message to any listeners
          this.dispatchEvent(new MessageEvent('message', { data }));
        } catch (error) {
          console.error('CastKit [SSE PARSE ERROR]:', error);
        }
      }
    };
    
    // Handle errors
    this.eventSource.onerror = (error) => {
      console.error('CastKit [SSE ERROR]:', error);
      
      // Try to reconnect
      this.closeEventSource();
      setTimeout(() => this.connectEventSource(), 5000);
    };
  }
  
  /**
   * Close the event source
   */
  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
  
  /**
   * Clean up resources when the bridge is no longer needed
   */
  public dispose(): void {
    // Close the event source
    this.closeEventSource();
    
    // Clear all pending requests
    for (const { timer, reject } of this.pendingRequests.values()) {
      clearTimeout(timer);
      reject(new Error('Bridge disposed'));
    }
    
    // Clear the maps
    this.pendingRequests.clear();
    this.eventListeners.clear();
  }
  
  /**
   * Get the session ID
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }
  
  /**
   * Terminate the session
   */
  public async terminateSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }
    
    const headers: Record<string, string> = {};
    
    // Add authentication if available
    if (this.options.authToken) {
      headers['Authorization'] = `Bearer ${this.options.authToken}`;
    }
    
    // Add session ID
    headers['Cast-Session-Id'] = this.sessionId;
    
    try {
      await fetch(`${this.options.baseUrl}/message`, {
        method: 'DELETE',
        headers
      });
      
      // Reset session state
      this.sessionId = null;
      this.lastEventId = null;
      
      // Close the event source
      this.closeEventSource();
    } catch (error) {
      console.error('CastKit [SESSION TERMINATE ERROR]:', error);
      throw error;
    }
  }
}

/**
 * Create an HTTP bridge
 */
export function createHttpBridge(options: HttpBridgeOptions): SessionBridge {
  return new HttpBridge(options);
} 