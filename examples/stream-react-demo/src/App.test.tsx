import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';

// No explicit mocking needed here anymore, App handles it internally based on import.meta.env.VITEST

describe('App', () => {
  beforeEach(() => {
    // Clear any previous test side effects if needed
    // vi.clearAllMocks(); // May not be necessary if mock is internal to App
  });

  it('renders app title and view buttons after mock initialization', async () => {
    render(<App />);
    // Wait for the mock stream to reach 'streaming' state
    await waitFor(() => {
      // Check for elements that appear once streaming
      expect(screen.getByText('Stream Kit Demo')).toBeInTheDocument();
      expect(screen.getByText('World View')).toBeInTheDocument();
      expect(screen.getByText('Map View')).toBeInTheDocument();
      // Check that the loading indicator is gone
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      // Check that the initial video element is present
      expect(screen.getByTestId('video-mock-world')).toBeInTheDocument();
    });
  });

  it('switches views and displays correct video when buttons are clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for initial view (world)
    await waitFor(() => {
      expect(screen.getByTestId('video-mock-world')).toBeInTheDocument();
    });

    // Click map view button
    await user.click(screen.getByText('Map View'));

    // Wait for map view video
    await waitFor(() => {
      expect(screen.getByTestId('video-mock-map')).toBeInTheDocument();
      // Ensure world video is removed/replaced
      expect(screen.queryByTestId('video-mock-world')).not.toBeInTheDocument();
    });

    // Click world view button
    await user.click(screen.getByText('World View'));

    // Wait for world view video
    await waitFor(() => {
      expect(screen.getByTestId('video-mock-world')).toBeInTheDocument();
      // Ensure map video is removed/replaced
      expect(screen.queryByTestId('video-mock-map')).not.toBeInTheDocument();
    });
  });
}); 