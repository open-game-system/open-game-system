/**
 * Example of testing a component with the mock client
 * 
 * This file demonstrates how to test a component that depends on the CastKitContext
 * using the mock client.
 * 
 * Note: This is just an example and is not meant to be run directly.
 * In a real project, you would put this in a test file like:
 * src/react/components/CastController.test.tsx
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CastKitContext } from '../react/context';
import { createMockClient } from './createMockClient';

// Declare test globals to satisfy TypeScript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    interface Assertion {
      toHaveTextContent(text: string): void;
      toBeInTheDocument(): void;
    }
  }

  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => void): void;
  function expect<T>(actual: T): {
    toBe(expected: T): void;
    toEqual(expected: T): void;
    toHaveTextContent(text: string): void;
    toBeInTheDocument(): void;
    // Add other matchers as needed
  };
}

// Example component that uses the CastKitContext
function CastController() {
  const { useSelector, useSend } = CastKitContext;
  
  // Select state values we're interested in
  const devices = useSelector(state => state.devices);
  const isCasting = useSelector(state => state.isCasting);
  const deviceName = useSelector(state => state.deviceName);
  
  // Get the send function for dispatching events
  const send = useSend();
  
  // Handle device selection
  const handleCast = (deviceId: string) => {
    send.startCasting(deviceId);
  };
  
  // Handle stopping the cast
  const handleStop = () => {
    send.stopCasting();
  };
  
  return (
    <div>
      <h2>Cast Controller</h2>
      
      {isCasting ? (
        <div>
          <p data-testid="casting-status">Currently casting to: {deviceName}</p>
          <button type="button" onClick={handleStop}>Stop Casting</button>
        </div>
      ) : (
        <div>
          <p data-testid="casting-status">Not casting</p>
          <h3>Available Devices:</h3>
          <ul>
            {devices.map(device => (
              <li key={device.id}>
                <button 
                  type="button"
                  onClick={() => handleCast(device.id)}
                  data-testid={`cast-button-${device.id}`}
                >
                  Cast to {device.name}
                </button>
              </li>
            ))}
          </ul>
          {devices.length === 0 && <p>No devices available</p>}
        </div>
      )}
    </div>
  );
}

// Example test
// This would normally be run with vitest, jest, or another test runner
describe('CastController', () => {
  it('displays available devices and allows casting', async () => {
    // Create a mock client with some initial devices
    const mockClient = createMockClient({
      initialState: {
        devices: [
          { id: 'device-1', name: 'Living Room TV', type: 'chromecast', isConnected: false },
          { id: 'device-2', name: 'Bedroom TV', type: 'chromecast', isConnected: false }
        ]
      },
      debug: true
    });
    
    // Render the component with the mock client
    render(
      <CastKitContext.ProviderFromClient client={mockClient}>
        <CastController />
      </CastKitContext.ProviderFromClient>
    );
    
    // Initially should show not casting
    expect(screen.getByTestId('casting-status')).toHaveTextContent('Not casting');
    
    // Should show the available devices
    expect(screen.getByText('Living Room TV')).toBeInTheDocument();
    expect(screen.getByText('Bedroom TV')).toBeInTheDocument();
    
    // Click on a cast button
    fireEvent.click(screen.getByTestId('cast-button-device-1'));
    
    // Wait for the casting to start and status to update
    await waitFor(() => {
      expect(screen.getByTestId('casting-status')).toHaveTextContent('Living Room TV');
    });
    
    // Should now have a stop button
    const stopButton = screen.getByText('Stop Casting');
    expect(stopButton).toBeInTheDocument();
    
    // Click the stop button
    fireEvent.click(stopButton);
    
    // Wait for casting to stop
    await waitFor(() => {
      expect(screen.getByTestId('casting-status')).toHaveTextContent('Not casting');
    });
  });
  
  it('handles the case when no devices are available', () => {
    // Create a mock client with no devices
    const mockClient = createMockClient();
    
    // Render the component with the mock client
    render(
      <CastKitContext.ProviderFromClient client={mockClient}>
        <CastController />
      </CastKitContext.ProviderFromClient>
    );
    
    // Should show a message about no devices
    expect(screen.getByText('No devices available')).toBeInTheDocument();
  });
}); 