import { useState, useEffect, useCallback } from 'react';
import { createStreamClient as createRealStreamClient } from '@open-game-system/stream-kit-web';
import type { RenderStream, CreateRenderStreamParams, StreamClient } from '@open-game-system/stream-kit-web';
import type { StreamState } from '@open-game-system/stream-kit-types';

// --- Mock Client for Testing ---
// Define the parameter type expected by the *method* on the client, which excludes 'client' itself.
type CreateRenderStreamMethodParams = Omit<CreateRenderStreamParams, 'client'>;

const createMockRenderStreamForTest = (params: CreateRenderStreamMethodParams): RenderStream => {
  const { url } = params;
  let listeners: ((state: StreamState) => void)[] = [];
  let currentState: StreamState = { status: 'connecting' };
  const videoElement = document.createElement('video');
  videoElement.dataset.testid = `video-mock-${url?.split('/').pop() || 'unknown'}`;

  const stream: RenderStream = {
    id: `mock-${url?.split('/').pop() || 'unknown'}`,
    url: url || 'unknown',
    state: currentState,
    start: async () => {
      currentState = { status: 'streaming', fps: 60, latency: 30 };
      queueMicrotask(() => listeners.forEach(l => l(currentState)));
      return Promise.resolve();
    },
    end: async () => {
       currentState = { status: 'ended' };
       queueMicrotask(() => listeners.forEach(l => l(currentState)));
       return Promise.resolve();
    },
    send: () => {},
    update: async () => {},
    subscribe: (listener) => {
      listeners.push(listener);
      queueMicrotask(() => listener(currentState));
      return () => { listeners = listeners.filter(l => l !== listener); };
    },
    getVideoElement: () => videoElement,
    destroy: () => { currentState = { status: 'ended' }; queueMicrotask(() => listeners.forEach(l => l(currentState))); listeners = []; },
  };
  if (params.autoConnect) {
    queueMicrotask(() => { if (currentState.status === 'connecting') void stream.start(); });
  }
  return stream;
};

// Define the mock client matching the StreamClient interface
const mockClientForTest: StreamClient = {
  // Ensure the mock function signature matches the method on StreamClient
  createRenderStream: (params: CreateRenderStreamMethodParams): RenderStream => createMockRenderStreamForTest(params),
  // Add mock implementations for other StreamClient methods if needed
  requestStream: vi.fn(),
  endStream: vi.fn(),
  sendEvent: vi.fn(),
  updateStream: vi.fn(),
};
// --- End Mock Client ---

// Use mock client in Vitest environment, otherwise use real client
const client: StreamClient = import.meta.env.VITEST ? mockClientForTest : createRealStreamClient({
  brokerUrl: 'https://opengame.tv/stream'
});

// Main App component
export default function App() {
  const [activeView, setActiveView] = useState<'world' | 'map'>('world');
  const [worldStream, setWorldStream] = useState<RenderStream | null>(null);
  const [mapStream, setMapStream] = useState<RenderStream | null>(null);
  const [streamState, setStreamState] = useState<StreamState | null>(null);
  const [currentVideoElement, setCurrentVideoElement] = useState<HTMLVideoElement | null>(null);

  // Initialize streams
  useEffect(() => {
    let isSubscribed = true;
    let currentWorldStream: RenderStream | null = null;
    let currentMapStream: RenderStream | null = null;

    function initializeStreams() {
      try {
        const worldStreamInstance = client.createRenderStream({
          url: 'http://localhost:3001/world',
          autoConnect: true
        });

        const mapStreamInstance = client.createRenderStream({
          url: 'http://localhost:3001/map',
          renderOptions: { resolution: '720p' },
          autoConnect: true
        });

        if (isSubscribed) {
          setWorldStream(worldStreamInstance);
          setMapStream(mapStreamInstance);
          currentWorldStream = worldStreamInstance;
          currentMapStream = mapStreamInstance;
        }
      } catch (error) {
        console.error('Failed to initialize streams:', error);
      }
    }

    initializeStreams();

    return () => {
      isSubscribed = false;
      currentWorldStream?.destroy();
      currentMapStream?.destroy();
    };
  }, []);

  const activeStream = activeView === 'world' ? worldStream : mapStream;

  // Handle stream state changes and get video element
  useEffect(() => {
    let isMounted = true;
    if (!activeStream) {
      setCurrentVideoElement(null); 
      setStreamState(null);
      return;
    }

    const videoElement = activeStream.getVideoElement();
    if (videoElement) {
      videoElement.playsInline = true;
      videoElement.autoplay = true;
      videoElement.muted = true;
      videoElement.classList.add('stream-canvas');
      videoElement.dataset.testid = `video-${activeStream.id}`;
       // Set the video element in state only if component is still mounted
      if (isMounted) {
         setCurrentVideoElement(videoElement);
      }
    }

    const unsubscribe = activeStream.subscribe((state) => {
       if (isMounted) {
         setStreamState(state);
         if(currentVideoElement) currentVideoElement.dataset.state = state.status;
       }
    });

    // Cleanup: remove video element state, could also pause video
    return () => {
      isMounted = false;
      unsubscribe();
      setCurrentVideoElement(null); // Clear on cleanup
    };
  // Rerun when the active stream changes or the current video element changes
  }, [activeStream, currentVideoElement]); // Added currentVideoElement

  // Handle retry
  const handleRetry = useCallback(() => {
    // Use the activeStream derived from state
    activeStream?.start();
  }, [activeStream]);

  // Check loading state
  if (!activeStream || !streamState ) {
    return <div data-testid="loading">Initializing streams...</div>;
  }

  return (
    <div className="app">
      <h1>Stream Kit Demo</h1>
      <div className="view-selector">
        <button onClick={() => setActiveView('world')} disabled={activeView === 'world'}>World View</button>
        <button onClick={() => setActiveView('map')} disabled={activeView === 'map'}>Map View</button>
      </div>

      <div className="stream-container">
        <div className="video-wrapper">
          {streamState.status === 'streaming' && currentVideoElement ? (
             <div ref={(node: HTMLDivElement | null) => {
               if (node && !node.contains(currentVideoElement)) {
                 while (node.firstChild) {
                   node.removeChild(node.firstChild);
                 }
                 node.appendChild(currentVideoElement);
               }
             }} />
          ) : (
            <div className="placeholder" style={{backgroundColor: '#222', width: '100%', height: '480px'}} data-testid="placeholder">
              {/* Placeholder shown when not streaming */}
            </div>
          )}
        </div>

        {/* Loading overlay */} 
        {streamState.status === 'connecting' && (
          <div className="overlay connecting" data-testid="connecting-overlay">
            Connecting to stream...
          </div>
        )}

        {/* Error overlay */} 
        {streamState.status === 'error' && (
          <div className="overlay error" data-testid="error-overlay">
            <div>An error occurred: {streamState.errorMessage || 'Unknown error'}</div>
            <button onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}

        {/* Status indicator (only show if streaming) */}
        {streamState.status === 'streaming' && (
          <div className="controls">
            <div className="status status-streaming">
              Connected (FPS: {streamState.fps}, Latency: {streamState.latency}ms)
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 