import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Mock ResizeObserver which is not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock MediaStream API
global.MediaStream = class MockMediaStream {} as unknown as typeof MediaStream;

afterEach(() => {
  cleanup();
});
