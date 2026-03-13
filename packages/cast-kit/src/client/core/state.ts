/**
 * Core state management for Cast Kit
 */

import { CastState } from './types';

/**
 * Initial state for Cast Kit client
 */
export const initialState: CastState = {
  isAvailable: false,
  isCasting: false,
  isConnecting: false,
  isScanning: false,
  deviceName: null,
  deviceId: null,
  sessionId: null,
  devices: [],
  error: null,
};

/**
 * State listener function
 */
export type StateListener<T = CastState> = (state: T) => void;

/**
 * State selector function
 */
export type StateSelector<T, S = CastState> = (state: S) => T;

// Type for the selector state
interface SelectorState<T> {
  value: T;
  listeners: Set<StateListener<T>>;
}

// Create a more flexible Record type for our state manager
export type AnyRecord = Record<string, unknown>;

/**
 * Simple state manager
 */
export class StateManager<T> {
  private state: T;
  private listeners: Set<StateListener<T>> = new Set();
  private selectors = new Map<StateSelector<unknown, T>, SelectorState<unknown>>();

  constructor(initialState: T) {
    this.state = { ...initialState } as T;
  }

  /**
   * Get the current state
   */
  public getState(): T {
    return { ...this.state };
  }

  /**
   * Update the state
   */
  public setState(updater: Partial<T> | ((state: T) => Partial<T>)): void {
    // Calculate the new state
    const updates = typeof updater === 'function'
      ? updater(this.getState())
      : updater;

    // Update the state
    this.state = { ...this.state, ...updates };

    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Subscribe to all state changes
   */
  public subscribe(listener: StateListener<T>): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to a specific slice of state
   */
  public select<S>(selector: StateSelector<S, T>, listener: StateListener<S>): () => void {
    // Get the current selector state
    let selectorState = this.selectors.get(selector as StateSelector<unknown, T>);

    // If this is a new selector, create its state
    if (!selectorState) {
      const initialValue = selector(this.state);
      selectorState = {
        value: initialValue,
        listeners: new Set<StateListener<unknown>>(),
      };
      this.selectors.set(selector as StateSelector<unknown, T>, selectorState);
    }

    // Add the listener, casting to unknown first to satisfy the type system
    selectorState.listeners.add(listener as unknown as StateListener<unknown>);

    // Return unsubscribe function
    return () => {
      const state = this.selectors.get(selector as StateSelector<unknown, T>);
      if (state) {
        state.listeners.delete(listener as unknown as StateListener<unknown>);
        if (state.listeners.size === 0) {
          this.selectors.delete(selector as StateSelector<unknown, T>);
        }
      }
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    // Notify global listeners
    for (const listener of this.listeners) {
      listener(this.getState());
    }

    // Notify selector listeners if their value changed
    for (const [selector, selectorState] of this.selectors.entries()) {
      const newValue = selector(this.state);
      if (!this.isEqual(selectorState.value, newValue)) {
        selectorState.value = newValue;
        for (const listener of selectorState.listeners) {
          listener(newValue);
        }
      }
    }
  }

  /**
   * Simple deep equality check
   */
  private isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (!a || !b) return false; // Check for undefined

    // At this point we know both a and b are objects
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
      if (!this.isEqual(objA[key], objB[key])) return false;
    }

    return true;
  }
} 