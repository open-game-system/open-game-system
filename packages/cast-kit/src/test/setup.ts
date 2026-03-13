import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Set up browser environment if needed
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://example.com',
    origin: 'https://example.com',
    pathname: '/',
    search: '',
    hash: '',
    host: 'example.com',
    hostname: 'example.com',
    protocol: 'https:',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
});

// Mock window event listeners for tests
// Create an event listener registry
const eventListenerMap: Record<string, EventListenerOrEventListenerObject[]> = {};

// Override window.addEventListener
const originalAddEventListener = window.addEventListener;
window.addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
  if (!eventListenerMap[type]) {
    eventListenerMap[type] = [];
  }
  eventListenerMap[type].push(listener);
  return originalAddEventListener?.call(window, type, listener, options);
});

// Override window.removeEventListener
const originalRemoveEventListener = window.removeEventListener;
window.removeEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
  if (eventListenerMap[type]) {
    eventListenerMap[type] = eventListenerMap[type].filter(l => l !== listener);
  }
  return originalRemoveEventListener?.call(window, type, listener, options);
});

// Override window.dispatchEvent
const originalDispatchEvent = window.dispatchEvent;
window.dispatchEvent = vi.fn((event: Event) => {
  const listeners = eventListenerMap[event.type] || [];
  
  // Use for...of instead of forEach for better performance
  for (const listener of listeners) {
    if (typeof listener === 'function') {
      listener.call(window, event);
    } else {
      listener.handleEvent(event);
    }
  }
  
  return originalDispatchEvent?.call(window, event) ?? true;
}); 