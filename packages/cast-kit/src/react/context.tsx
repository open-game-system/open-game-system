/**
 * React Context for Cast Kit
 * 
 * This module provides a React context for using Cast Kit within React applications.
 */

import React, { createContext, useContext, ReactNode, useState as reactUseState, useEffect, useRef, useMemo } from 'react';
import { CastClient } from '../client/core/client';
import { CastState } from '../client/core/types';

/**
 * Context value type
 */
export interface CastKitContextValue {
  client: CastClient;
}

/**
 * Props for the context provider
 */
export interface ProviderProps {
  client: CastClient;
  children: ReactNode;
}

/**
 * Props for the When component
 */
export interface WhenProps {
  casting: boolean;
  children: ReactNode;
}

/**
 * Props for the Devices component
 */
export interface DevicesProps {
  children: (props: {
    devices: CastState['devices'];
    isScanning: boolean;
    scanForDevices: () => Promise<void>;
  }) => ReactNode;
}

/**
 * Props for the Status component
 */
export interface StatusProps {
  children: (props: {
    isCasting: boolean;
    isConnecting: boolean;
    deviceName: string | null;
    error: CastState['error'];
  }) => ReactNode;
}

/**
 * Create a React context for Cast Kit
 */
export function createCastKitContext() {
  // Create the React context with a default value
  const Context = createContext<CastKitContextValue | null>(null);

  /**
   * Provider component for the context
   */
  function Provider({ client, children }: ProviderProps) {
    const value = useMemo(() => ({ client }), [client]);
    
    return (
      <Context.Provider value={value}>
        {children}
      </Context.Provider>
    );
  }

  /**
   * Provider component that accepts a pre-configured client
   * This is particularly useful for testing with mock clients
   */
  function ProviderFromClient({ client, children }: ProviderProps) {
    return (
      <Context.Provider value={{ client }}>
        {children}
      </Context.Provider>
    );
  }

  /**
   * Custom hook to access the client from context
   */
  function useClient(): CastClient {
    const context = useContext(Context);
    
    if (!context) {
      throw new Error('useClient must be used within a CastKitContext.Provider');
    }
    
    return context.client;
  }

  /**
   * Custom hook to subscribe to state changes with a selector
   */
  function useSelector<T>(selector: (state: CastState) => T): T {
    const client = useClient();
    // Initialize state correctly without type parameter
    const [selectedState, setSelectedState] = reactUseState(() => selector(client.getState()));
    
    // Keep the latest selector function in a ref
    const latestSelector = useRef(selector);
    
    // Update the ref when the selector changes
    useEffect(() => {
      latestSelector.current = selector;
    }, [selector]);
    
    // Subscribe to state changes
    useEffect(() => {
      // Subscribe to state changes
      const unsubscribe = client.subscribe((state) => {
        const newSelectedState = latestSelector.current(state);
        // Fix type issue by using a properly typed function
        setSelectedState((prevState: T) => {
          // Simple equality check to prevent unnecessary re-renders
          return deepEqual(prevState, newSelectedState) ? prevState : newSelectedState;
        });
      });
      
      // Cleanup
      return unsubscribe;
    }, [client]); // Remove selector from dependencies since we use the ref
    
    return selectedState;
  }

  /**
   * Custom hook to subscribe to all state changes
   */
  function useState(): CastState {
    return useSelector(state => state);
  }

  /**
   * Custom hook to subscribe to cast devices
   */
  function useDevices() {
    const client = useClient();
    const devices = useSelector(state => state.devices);
    const isScanning = useSelector(state => state.isScanning);
    
    const scanForDevices = async () => {
      await client.scanForDevices();
    };
    
    return { devices, isScanning, scanForDevices };
  }

  /**
   * Custom hook to access cast status
   */
  function useStatus() {
    const isCasting = useSelector(state => state.isCasting);
    const isConnecting = useSelector(state => state.isConnecting);
    const deviceName = useSelector(state => state.deviceName);
    const error = useSelector(state => state.error);
    
    return { isCasting, isConnecting, deviceName, error };
  }

  /**
   * Custom hook to get an object with all the client methods for easy access
   */
  function useSend() {
    const client = useClient();
    return {
      signalReady: client.signalReady.bind(client),
      scanForDevices: client.scanForDevices.bind(client),
      startCasting: client.startCasting.bind(client),
      stopCasting: client.stopCasting.bind(client),
      sendStateUpdate: client.sendStateUpdate.bind(client),
      resetError: client.resetError.bind(client)
    };
  }

  /**
   * Container component for conditional rendering based on casting state
   */
  function When({ casting, children }: WhenProps) {
    const isCasting = useSelector(state => state.isCasting);
    
    return (casting === isCasting) ? <>{children}</> : null;
  }

  /**
   * Container component for rendering devices
   */
  function Devices({ children }: DevicesProps) {
    const { devices, isScanning, scanForDevices } = useDevices();
    
    return <>{children({ devices, isScanning, scanForDevices })}</>;
  }

  /**
   * Container component for rendering status
   */
  function Status({ children }: StatusProps) {
    const { isCasting, isConnecting, deviceName, error } = useStatus();
    
    return <>{children({ isCasting, isConnecting, deviceName, error })}</>;
  }

  // Return the context, provider, and hooks
  return {
    Context,
    Provider,
    ProviderFromClient,
    useClient,
    useSelector,
    useState,
    useDevices,
    useStatus,
    useSend,
    // Container components
    When,
    Devices,
    Status,
  };
}

/**
 * Simple deep equality check
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  // At this point we know both a and b are objects
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    if (!deepEqual(objA[key], objB[key])) return false;
  }

  return true;
}

/**
 * Default context instance
 */
export const CastKitContext = createCastKitContext(); 