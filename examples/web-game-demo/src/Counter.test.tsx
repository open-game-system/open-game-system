import { createBridgeContext } from "@open-game-system/app-bridge-react";
import { createMockBridge, type MockBridge } from "@open-game-system/app-bridge-testing";
import type { Bridge } from "@open-game-system/app-bridge-types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Counter } from "./Counter";
import type { AppStores } from "./types";

// Create test-specific contexts
const TestBridgeContext = createBridgeContext<AppStores>();
const TestCounterContext = TestBridgeContext.createStoreContext("counter");

describe("Counter", () => {
  let mockBridge: MockBridge<AppStores>;

  beforeEach(() => {
    // Use createMockBridge directly
    mockBridge = createMockBridge<AppStores>({
      initialState: {
        counter: { value: 0 },
      },
    });
  });

  it("renders initial counter value", () => {
    render(
      // Cast to Bridge<AppStores> where the Provider expects it
      <TestBridgeContext.Provider bridge={mockBridge as Bridge<AppStores>}>
        <TestCounterContext.Provider>
          <Counter BridgeContext={TestBridgeContext} CounterContext={TestCounterContext} />
        </TestCounterContext.Provider>
      </TestBridgeContext.Provider>,
    );

    expect(screen.getByText("Web Bridge Counter:")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("increments counter when + button is clicked", async () => {
    render(
      <TestBridgeContext.Provider bridge={mockBridge as Bridge<AppStores>}>
        <TestCounterContext.Provider>
          <Counter BridgeContext={TestBridgeContext} CounterContext={TestCounterContext} />
        </TestCounterContext.Provider>
      </TestBridgeContext.Provider>,
    );

    fireEvent.click(screen.getByText("+"));

    const history = mockBridge.getHistory("counter");
    expect(history).toContainEqual({ type: "INCREMENT" });

    await act(async () => {
      const store = mockBridge.getStore("counter");
      if (store) {
        store.setState({ value: 1 });
      }
    });

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("decrements counter when - button is clicked", async () => {
    render(
      <TestBridgeContext.Provider bridge={mockBridge as Bridge<AppStores>}>
        <TestCounterContext.Provider>
          <Counter BridgeContext={TestBridgeContext} CounterContext={TestCounterContext} />
        </TestCounterContext.Provider>
      </TestBridgeContext.Provider>,
    );

    fireEvent.click(screen.getByText("-"));

    const history = mockBridge.getHistory("counter");
    expect(history).toContainEqual({ type: "DECREMENT" });

    await act(async () => {
      const store = mockBridge.getStore("counter");
      if (store) {
        store.setState({ value: -1 });
      }
    });

    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("sets counter value when Set Value button is clicked", async () => {
    render(
      <TestBridgeContext.Provider bridge={mockBridge as Bridge<AppStores>}>
        <TestCounterContext.Provider>
          <Counter BridgeContext={TestBridgeContext} CounterContext={TestCounterContext} />
        </TestCounterContext.Provider>
      </TestBridgeContext.Provider>,
    );

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "42" } });

    fireEvent.click(screen.getByText("Set Value"));

    const history = mockBridge.getHistory("counter");
    expect(history).toContainEqual({ type: "SET", value: 42 });

    await act(async () => {
      const store = mockBridge.getStore("counter");
      if (store) {
        store.setState({ value: 42 });
      }
    });

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows loading state when store is not available", () => {
    const emptyBridge = createMockBridge<AppStores>({ isSupported: true });

    render(
      // Cast to Bridge<AppStores> where the Provider expects it
      <TestBridgeContext.Provider bridge={emptyBridge as Bridge<AppStores>}>
        <TestCounterContext.Provider>
          <Counter BridgeContext={TestBridgeContext} CounterContext={TestCounterContext} />
        </TestCounterContext.Provider>
        <TestCounterContext.Loading>
          <div>Waiting for counter data from native app...</div>
        </TestCounterContext.Loading>
      </TestBridgeContext.Provider>,
    );

    expect(screen.getByText("Waiting for counter data from native app...")).toBeInTheDocument();
  });

  it("shows unsupported message when bridge is not supported", () => {
    const unsupportedBridge = createMockBridge<AppStores>({
      isSupported: false,
      initialState: {
        counter: { value: 0 },
      },
    });

    render(
      // Cast to Bridge<AppStores> where the Provider expects it
      <TestBridgeContext.Provider bridge={unsupportedBridge as Bridge<AppStores>}>
        <Counter BridgeContext={TestBridgeContext} CounterContext={TestCounterContext} />
      </TestBridgeContext.Provider>,
    );

    expect(screen.getByText("Bridge reports as unsupported")).toBeInTheDocument();
  });
});
