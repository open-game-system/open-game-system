/// <reference types="jest" />

import { createMockBridge } from "@open-game-system/app-bridge-testing";
import type { BridgeStores, NativeBridge } from "@open-game-system/app-bridge-types";
import { renderHook } from "@testing-library/react-native";
import type React from "react";
import { createNativeBridgeContext } from "../createNativeBridgeContext";

// Define test-specific store types
interface TestStores extends BridgeStores {
  counter: {
    state: { value: number };
    events: { type: "INCREMENT" } | { type: "DECREMENT" };
  };
}

// Helper to create a fully typed Native mock bridge
const createFullyMockedNativeBridge = () => {
  const baseMock = createMockBridge<TestStores>();
  const nativeBridge: NativeBridge<TestStores> = {
    ...baseMock,
    handleWebMessage: jest.fn(),
    registerWebView: jest.fn(() => jest.fn()),
    unregisterWebView: jest.fn(),
    subscribeToReadyState: jest.fn(() => jest.fn()),
    getReadyState: jest.fn().mockReturnValue(true),
    setStore: jest.fn(),
  };
  return nativeBridge;
};

describe("createNativeBridgeContext", () => {
  it("should create a bridge context with hooks", () => {
    const { BridgeProvider, useBridge, createNativeStoreContext } =
      createNativeBridgeContext<TestStores>();
    expect(BridgeProvider).toBeDefined();
    expect(useBridge).toBeDefined();
    expect(createNativeStoreContext).toBeDefined();
  });

  it("should access the bridge through context", () => {
    const mockBridge = createFullyMockedNativeBridge(); // Use helper
    const { BridgeProvider, useBridge } = createNativeBridgeContext<TestStores>();

    const { result } = renderHook(() => useBridge(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <BridgeProvider bridge={mockBridge}>{children}</BridgeProvider>
      ),
    });

    expect(result.current).toBe(mockBridge);
  });

  it("should access store state through context", () => {
    const mockBridge = createFullyMockedNativeBridge(); // Use helper
    const mockStore = {
      getSnapshot: jest.fn(() => ({ value: 42 })), // Provide initial state
      subscribe: jest.fn(() => () => {}), // Return an unsubscribe function
      dispatch: jest.fn(),
    };
    // Override the helper's getStore for this specific test
    mockBridge.getStore = jest.fn().mockReturnValue(mockStore);

    const { BridgeProvider, createNativeStoreContext } = createNativeBridgeContext<TestStores>();
    const { StoreProvider: CounterStoreProvider, useSelector } =
      createNativeStoreContext("counter");

    const { result } = renderHook(() => useSelector((state) => state.value), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <BridgeProvider bridge={mockBridge}>
          <CounterStoreProvider>{children}</CounterStoreProvider>
        </BridgeProvider>
      ),
    });

    expect(result.current).toBe(42); // Check if the selector gets the value
    expect(mockBridge.getStore).toHaveBeenCalledWith("counter");
    expect(mockStore.subscribe).toHaveBeenCalled(); // Ensure subscription happened
  });

  it("should throw error when hooks are used outside Provider", () => {
    const { useBridge, createNativeStoreContext } = createNativeBridgeContext<TestStores>();
    const { useStore, useSelector } = createNativeStoreContext("counter");

    // Test useBridge
    const { result: bridgeResult } = renderHook(() => {
      try {
        useBridge();
        return null;
      } catch (e) {
        return e;
      }
    });
    expect(bridgeResult.current).toBeInstanceOf(Error);
    expect((bridgeResult.current as Error).message).toBe(
      "useBridge must be used within a BridgeProvider",
    );

    // Test useStore
    const { result: storeResult } = renderHook(() => {
      try {
        useStore();
        return null;
      } catch (e) {
        return e;
      }
    });
    expect(storeResult.current).toBeInstanceOf(Error);
    expect((storeResult.current as Error).message).toMatch(/must be used within its StoreProvider/);

    // Test useSelector
    const { result: selectorResult } = renderHook(() => {
      try {
        useSelector((s) => s.value);
        return null;
      } catch (e) {
        return e;
      }
    });
    expect(selectorResult.current).toBeInstanceOf(Error);
    expect((selectorResult.current as Error).message).toMatch(
      /must be used within its StoreProvider/,
    );
  });
});
