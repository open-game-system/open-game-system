/**
 * React components for Cast Kit
 * 
 * This module provides ready-to-use React components for integrating
 * Cast Kit into React applications.
 */

import React from 'react';
import { CastClient } from '../client/core/client';
import { CastKitContext } from './context';

/**
 * Cast Button props
 */
export interface CastButtonProps {
  /**
   * Optional custom class name
   */
  className?: string;
  
  /**
   * Button label 
   * @default "Cast to TV"
   */
  label?: string;
  
  /**
   * URL to broadcast to the TV
   */
  gameUrl?: string;
  
  /**
   * Game ID for casting
   */
  gameId?: string;
  
  /**
   * Room code for casting
   */
  roomCode?: string;
  
  /**
   * Disable the button
   */
  disabled?: boolean;
  
  /**
   * Called when casting is initiated
   */
  onCast?: () => void;
  
  /**
   * Called when casting is ended
   */
  onEnd?: () => void;
  
  /**
   * Cast client instance (optional if using context)
   */
  client?: CastClient;
}

/**
 * Cast Button component
 * 
 * A button that initiates or ends a cast session.
 */
export function CastButton({
  className = '',
  label,
  gameUrl,
  gameId,
  roomCode,
  disabled = false,
  onCast,
  onEnd,
  client: propClient,
}: CastButtonProps) {
  // Either use the client from props or from context
  const contextClient = CastKitContext.useClient();
  const client = propClient || contextClient;
  
  // Get casting state
  const isCasting = CastKitContext.useSelector(state => state.isCasting);
  const isConnecting = CastKitContext.useSelector(state => state.isConnecting);
  
  // Generate a game URL if not provided but gameId is
  const getBroadcastUrl = () => {
    if (gameUrl) return gameUrl;
    
    if (gameId) {
      const url = new URL(`${window.location.origin}/cast`);
      url.searchParams.append('gameId', gameId);
      if (roomCode) {
        url.searchParams.append('roomCode', roomCode);
      }
      return url.toString();
    }
    
    return undefined;
  };
  
  // Handle button click
  const handleClick = async () => {
    if (isCasting) {
      try {
        await client.stopCasting();
        onEnd?.();
      } catch (error) {
        console.error('Failed to stop casting:', error);
      }
    } else {
      try {
        // Signal that we're ready to cast
        await client.signalReady({
          gameId: gameId || 'default',
          roomCode,
          broadcastUrl: getBroadcastUrl(),
        });
        
        // Scan for devices (this will trigger a device selection UI in the app)
        await client.scanForDevices();
        
        onCast?.();
      } catch (error) {
        console.error('Failed to start casting:', error);
      }
    }
  };
  
  // Determine the button label
  const buttonLabel = isCasting
    ? 'Stop Casting'
    : isConnecting
      ? 'Connecting...'
      : label || 'Cast to TV';
  
  return (
    <button
      className={`cast-button ${className}`}
      onClick={handleClick}
      disabled={disabled || isConnecting}
      type="button"
    >
      {buttonLabel}
    </button>
  );
}

/**
 * Cast Status props
 */
export interface CastStatusProps {
  /**
   * Optional custom class name
   */
  className?: string;
  
  /**
   * Show end button
   * @default true
   */
  showEndButton?: boolean;
  
  /**
   * Called when casting is ended
   */
  onEnd?: () => void;
  
  /**
   * Cast client instance (optional if using context)
   */
  client?: CastClient;
}

/**
 * Cast Status component
 * 
 * Displays the current casting status.
 */
export function CastStatus({
  className = '',
  showEndButton = true,
  onEnd,
  client: propClient,
}: CastStatusProps) {
  // Either use the client from props or from context
  const contextClient = CastKitContext.useClient();
  const client = propClient || contextClient;
  
  // Get casting state
  const isCasting = CastKitContext.useSelector(state => state.isCasting);
  const deviceName = CastKitContext.useSelector(state => state.deviceName);
  const error = CastKitContext.useSelector(state => state.error);
  
  // Handle end button click
  const handleEndClick = async () => {
    try {
      await client.stopCasting();
      onEnd?.();
    } catch (error) {
      console.error('Failed to stop casting:', error);
    }
  };
  
  if (error) {
    return (
      <div className={`cast-status cast-status--error ${className}`}>
        <div className="cast-status__message">
          Error: {error.message}
        </div>
        <button 
          className="cast-status__reset-button"
          onClick={() => client.resetError()}
          type="button"
        >
          Dismiss
        </button>
      </div>
    );
  }
  
  if (!isCasting) {
    return null;
  }
  
  return (
    <div className={`cast-status ${className}`}>
      <div className="cast-status__info">
        Casting to: {deviceName || 'TV'}
      </div>
      
      {showEndButton && (
        <button 
          className="cast-status__end-button"
          onClick={handleEndClick}
          type="button"
        >
          Stop Casting
        </button>
      )}
    </div>
  );
}

/**
 * Device List Props
 */
export interface DeviceListProps {
  /**
   * Optional custom class name
   */
  className?: string;
  
  /**
   * Called when a device is selected
   */
  onDeviceSelect?: (deviceId: string) => void;
  
  /**
   * Cast client instance (optional if using context)
   */
  client?: CastClient;
}

/**
 * Device List component
 * 
 * Displays a list of available cast devices.
 */
export function DeviceList({
  className = '',
  onDeviceSelect,
  client: propClient,
}: DeviceListProps) {
  // Either use the client from props or from context
  const contextClient = CastKitContext.useClient();
  const client = propClient || contextClient;
  
  // Get devices state
  const devices = CastKitContext.useSelector(state => state.devices);
  const isScanning = CastKitContext.useSelector(state => state.isScanning);
  
  // Handle scan button click
  const handleScanClick = () => {
    client.scanForDevices().catch((error) => {
      console.error('Failed to scan for devices:', error);
    });
  };
  
  // Handle device selection
  const handleDeviceClick = (deviceId: string) => {
    client.startCasting(deviceId).catch((error) => {
      console.error('Failed to start casting:', error);
    });
    onDeviceSelect?.(deviceId);
  };
  
  return (
    <div className={`cast-device-list ${className}`}>
      <div className="cast-device-list__header">
        <h3 className="cast-device-list__title">Available Devices</h3>
        <button 
          className="cast-device-list__scan-button"
          onClick={handleScanClick}
          disabled={isScanning}
          type="button"
        >
          {isScanning ? 'Scanning...' : 'Scan'}
        </button>
      </div>
      
      <ul className="cast-device-list__items">
        {devices.length === 0 ? (
          <li className="cast-device-list__empty">
            No devices found. Please scan for devices.
          </li>
        ) : (
          devices.map((device) => (
            <li 
              key={device.id}
              className="cast-device-list__item"
            >
              <button
                className="cast-device-list__device-button"
                onClick={() => handleDeviceClick(device.id)}
                disabled={device.isConnected}
                type="button"
              >
                {device.name}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
} 