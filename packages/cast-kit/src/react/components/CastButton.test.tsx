import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CastButton } from './CastButton';

// Mock client
const createMockClient = () => ({
  getState: vi.fn().mockReturnValue({
    isCasting: false,
    isConnecting: false,
    isScanning: false,
    devices: [
      { id: 'device1', name: 'Living Room TV', type: 'chromecast', isConnected: false }
    ],
    error: null
  }),
  subscribe: vi.fn().mockImplementation((listener) => {
    // Call the listener immediately with the initial state
    listener({
      isCasting: false,
      isConnecting: false,
      isScanning: false,
      devices: [
        { id: 'device1', name: 'Living Room TV', type: 'chromecast', isConnected: false }
      ],
      error: null
    });
    // Return unsubscribe function
    return vi.fn();
  }),
  scanForDevices: vi.fn().mockResolvedValue(undefined),
  startCasting: vi.fn().mockResolvedValue(undefined),
  stopCasting: vi.fn().mockResolvedValue(undefined),
  resetError: vi.fn()
});

describe('CastButton', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  
  beforeEach(() => {
    mockClient = createMockClient();
  });
  
  it('renders with default label', () => {
    render(
      <CastButton 
        client={mockClient}
      />
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Cast to TV');
  });
  
  it('renders with custom label', () => {
    render(
      <CastButton 
        client={mockClient}
        label="Play on Big Screen"
      />
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Play on Big Screen');
  });
  
  it('shows scanning state', () => {
    // Update the mock to return scanning state
    mockClient.getState.mockReturnValue({
      isCasting: false,
      isConnecting: false,
      isScanning: true,
      devices: [],
      error: null
    });
    
    // Update the subscribe mock to emit scanning state
    mockClient.subscribe.mockImplementation((listener) => {
      listener({
        isCasting: false,
        isConnecting: false,
        isScanning: true,
        devices: [],
        error: null
      });
      return vi.fn();
    });
    
    render(<CastButton client={mockClient} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Scanning...');
    expect(button).toBeDisabled();
  });
  
  it('shows connecting state', () => {
    // Update the mock to return connecting state
    mockClient.getState.mockReturnValue({
      isCasting: false,
      isConnecting: true,
      isScanning: false,
      devices: [
        { id: 'device1', name: 'Living Room TV', type: 'chromecast', isConnected: false }
      ],
      error: null
    });
    
    // Update the subscribe mock to emit connecting state
    mockClient.subscribe.mockImplementation((listener) => {
      listener({
        isCasting: false,
        isConnecting: true,
        isScanning: false,
        devices: [
          { id: 'device1', name: 'Living Room TV', type: 'chromecast', isConnected: false }
        ],
        error: null
      });
      return vi.fn();
    });
    
    render(<CastButton client={mockClient} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Connecting...');
    expect(button).toBeDisabled();
  });
  
  it('shows casting state', () => {
    // Update the mock to return casting state
    mockClient.getState.mockReturnValue({
      isCasting: true,
      isConnecting: false,
      isScanning: false,
      deviceId: 'device1',
      deviceName: 'Living Room TV',
      devices: [
        { id: 'device1', name: 'Living Room TV', type: 'chromecast', isConnected: true }
      ],
      error: null
    });
    
    // Update the subscribe mock to emit casting state
    mockClient.subscribe.mockImplementation((listener) => {
      listener({
        isCasting: true,
        isConnecting: false,
        isScanning: false,
        deviceId: 'device1',
        deviceName: 'Living Room TV',
        devices: [
          { id: 'device1', name: 'Living Room TV', type: 'chromecast', isConnected: true }
        ],
        error: null
      });
      return vi.fn();
    });
    
    render(<CastButton client={mockClient} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Stop Casting');
  });
  
  it('opens device selection dialog when clicked', async () => {
    render(<CastButton client={mockClient} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    // Should show device selection dialog
    expect(screen.getByText(/Select a device/i)).toBeInTheDocument();
    expect(screen.getByText(/Living Room TV/i)).toBeInTheDocument();
  });
  
  it('calls startCasting when device is selected', async () => {
    render(<CastButton client={mockClient} />);
    
    // Click button to open dialog
    fireEvent.click(screen.getByRole('button'));
    
    // Click on a device
    fireEvent.click(screen.getByText(/Living Room TV/i));
    
    expect(mockClient.startCasting).toHaveBeenCalledWith('device1', {});
  });
  
  it('calls stopCasting when clicked in casting state', async () => {
    // Set up casting state
    mockClient.getState.mockReturnValue({
      isCasting: true,
      isConnecting: false,
      isScanning: false,
      deviceId: 'device1',
      deviceName: 'Living Room TV',
      devices: [
        { id: 'device1', name: 'Living Room TV', type: 'chromecast', isConnected: true }
      ],
      error: null
    });
    
    mockClient.subscribe.mockImplementation((listener) => {
      listener({
        isCasting: true,
        isConnecting: false,
        isScanning: false,
        deviceId: 'device1',
        deviceName: 'Living Room TV',
        devices: [
          { id: 'device1', name: 'Living Room TV', type: 'chromecast', isConnected: true }
        ],
        error: null
      });
      return vi.fn();
    });
    
    render(<CastButton client={mockClient} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockClient.stopCasting).toHaveBeenCalled();
  });
  
  it('shows error message when there is an error', () => {
    // Set up error state
    mockClient.getState.mockReturnValue({
      isCasting: false,
      isConnecting: false,
      isScanning: false,
      devices: [],
      error: {
        code: 'TEST_ERROR',
        message: 'Test error message'
      }
    });
    
    mockClient.subscribe.mockImplementation((listener) => {
      listener({
        isCasting: false,
        isConnecting: false,
        isScanning: false,
        devices: [],
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message'
        }
      });
      return vi.fn();
    });
    
    render(<CastButton client={mockClient} />);
    
    // Check that error message is shown
    expect(screen.getByText(/Test error message/i)).toBeInTheDocument();
    
    // Check that dismiss button is present
    const dismissButton = screen.getByText(/Dismiss/i);
    expect(dismissButton).toBeInTheDocument();
    
    // Click dismiss button
    fireEvent.click(dismissButton);
    
    // Check that resetError was called
    expect(mockClient.resetError).toHaveBeenCalled();
  });
  
  it('calls scanForDevices when refresh button is clicked', async () => {
    render(<CastButton client={mockClient} />);
    
    // Click button to open dialog
    fireEvent.click(screen.getByRole('button'));
    
    // Find and click refresh button
    const refreshButton = screen.getByLabelText(/refresh/i);
    fireEvent.click(refreshButton);
    
    expect(mockClient.scanForDevices).toHaveBeenCalled();
  });
  
  it('calls onCast callback when casting starts', async () => {
    const onCast = vi.fn();
    
    render(
      <CastButton 
        client={mockClient}
        onCast={onCast}
      />
    );
    
    // Click button to open dialog
    fireEvent.click(screen.getByRole('button'));
    
    // Click on a device
    fireEvent.click(screen.getByText(/Living Room TV/i));
    
    // Wait for the async startCasting to resolve
    await vi.waitFor(() => {
      expect(onCast).toHaveBeenCalled();
    });
  });
  
  it('calls onEnd callback when casting stops', async () => {
    const onEnd = vi.fn();
    
    // Set up casting state
    mockClient.getState.mockReturnValue({
      isCasting: true,
      isConnecting: false,
      isScanning: false,
      deviceId: 'device1',
      deviceName: 'Living Room TV',
      devices: [
        { id: 'device1', name: 'Living Room TV', type: 'chromecast', isConnected: true }
      ],
      error: null
    });
    
    mockClient.subscribe.mockImplementation((listener) => {
      listener({
        isCasting: true,
        isConnecting: false,
        isScanning: false,
        deviceId: 'device1',
        deviceName: 'Living Room TV',
        devices: [
          { id: 'device1', name: 'Living Room TV', type: 'chromecast', isConnected: true }
        ],
        error: null
      });
      return vi.fn();
    });
    
    render(
      <CastButton 
        client={mockClient}
        onEnd={onEnd}
      />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    // Wait for the async stopCasting to resolve
    await vi.waitFor(() => {
      expect(onEnd).toHaveBeenCalled();
    });
  });
}); 