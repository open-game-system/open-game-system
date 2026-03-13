import React, { useState, useEffect } from 'react';
import { CastState, CastDevice, CastOptions } from '../../client/core/types';
import { CastClient } from '../../client/core/client';

/**
 * Props for the CastButton component
 */
export interface CastButtonProps {
  /** Cast Kit client instance */
  client: CastClient;
  
  /** Custom button label (default: "Cast to TV") */
  label?: string;
  
  /** CSS class name for the button */
  className?: string;
  
  /** Callback when casting starts */
  onCast?: () => void;
  
  /** Callback when casting ends */
  onEnd?: () => void;
  
  /** Additional options for casting */
  castOptions?: CastOptions;
}

/**
 * A button component that handles TV casting functionality
 */
export const CastButton: React.FC<CastButtonProps> = ({
  client,
  label = 'Cast to TV',
  className = '',
  onCast,
  onEnd,
  castOptions = {}
}) => {
  // Track component state
  const [state, setState] = useState<CastState>(client.getState());
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  
  // Subscribe to client state changes
  useEffect(() => {
    const unsubscribe = client.subscribe((newState: CastState) => {
      setState(newState);
    });
    
    return unsubscribe;
  }, [client]);
  
  // Handle button click
  const handleClick = async () => {
    if (state.isCasting) {
      // If already casting, stop casting
      try {
        await client.stopCasting();
        onEnd?.();
      } catch (error) {
        console.error('Failed to stop casting:', error);
      }
    } else {
      // If not casting, show device selector
      setShowDeviceSelector(true);
    }
  };
  
  // Handle device selection
  const handleDeviceSelect = async (device: CastDevice) => {
    setShowDeviceSelector(false);
    
    try {
      await client.startCasting(device.id, castOptions);
      onCast?.();
    } catch (error: unknown) {
      console.error('Failed to start casting:', error);
    }
  };
  
  // Handle refresh button click
  const handleRefresh = () => {
    client.scanForDevices().catch((error: unknown) => {
      console.error('Failed to scan for devices:', error);
    });
  };
  
  // Handle dismiss error
  const handleDismissError = () => {
    client.resetError();
  };
  
  // Determine button text based on state
  let buttonText = label;
  if (state.isScanning) {
    buttonText = 'Scanning...';
  } else if (state.isConnecting) {
    buttonText = 'Connecting...';
  } else if (state.isCasting) {
    buttonText = 'Stop Casting';
  }
  
  // Determine if button should be disabled
  const isDisabled = state.isScanning || state.isConnecting;
  
  return (
    <div className={`cast-kit-container ${className}`}>
      <button
        className="cast-kit-button"
        onClick={handleClick}
        disabled={isDisabled}
        type="button"
      >
        {buttonText}
      </button>
      
      {state.error && (
        <div className="cast-kit-error">
          <p className="cast-kit-error-message">{state.error.message}</p>
          <button
            className="cast-kit-error-dismiss"
            onClick={handleDismissError}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {showDeviceSelector && !state.isCasting && (
        <div className="cast-kit-device-selector">
          <div className="cast-kit-device-selector-header">
            <h3>Select a device</h3>
            <button
              className="cast-kit-refresh-button"
              onClick={handleRefresh}
              aria-label="refresh"
              type="button"
            >
              ↻
            </button>
          </div>
          
          <ul className="cast-kit-device-list">
            {state.devices.length === 0 ? (
              <li className="cast-kit-no-devices">No devices found</li>
            ) : (
              state.devices.map(device => (
                <div
                  key={device.id}
                  className="cast-kit-device-item"
                  onClick={() => handleDeviceSelect(device)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleDeviceSelect(device);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  {device.name}
                </div>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}; 