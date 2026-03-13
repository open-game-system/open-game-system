import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Mock HTMLMediaElement.play() which is not implemented in JSDOM
// Needed for tests involving video elements
window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = vi.fn(); // Also mock pause for completeness
window.HTMLMediaElement.prototype.load = vi.fn(); // Mock load as well

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock ResizeObserver
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('ResizeObserver', ResizeObserverMock); 