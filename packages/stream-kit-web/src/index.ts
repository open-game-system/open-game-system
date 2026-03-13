import {
  RenderOptions,
  StreamSession,
  StreamState,
  InputStreamEvent,
} from '@open-game-system/stream-kit-types';

// Default render options
const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  resolution: '1080p',
  quality: 'high',
  targetFps: 60
};

// Placeholder types and functions

export interface StreamClientOptions {
  brokerUrl: string; // Base URL for the OGS Stream API/Broker
  getAuthToken?: () => Promise<string | null> | string | null; // Optional async function to get auth token
}

export interface RequestStreamParams {
  renderUrl: string; // URL of the game scene/version to render
  renderOptions?: Partial<RenderOptions>; // Made partial to allow overriding only specific options
  initialData?: Record<string, any>; // Data to pass to the cloud instance
  // webRtcConfig might be client-generated if needed, or handled by broker
}

export interface StreamClient {
  /**
   * Requests a new cloud rendering stream session.
   */
  requestStream: (params: RequestStreamParams) => Promise<StreamSession>;

  /**
   * Ends an active stream session.
   */
  endStream: (sessionId: string) => Promise<void>;

  /**
   * Sends an event/input to an active stream session.
   */
  sendEvent: (sessionId: string, event: InputStreamEvent) => Promise<void>;

  /**
   * Updates a stream session.
   */
  updateStream: (sessionId: string, updates: { renderOptions?: RenderOptions, sceneData?: any }) => Promise<void>;

  /**
   * Creates a new render stream instance.
   */
  createRenderStream: (params: Omit<CreateRenderStreamParams, 'client'>) => RenderStream;
}

/**
 * Factory function to create the core stream client instance.
 * (Implementation details TBD)
 */
export function createStreamClient(options: StreamClientOptions): StreamClient {
  const brokerUrl = options.brokerUrl.replace(/\/$/, ''); // Remove trailing slash

  const getHeaders = async (): Promise<HeadersInit> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (options.getAuthToken) {
      const token = await options.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  };

  const client: StreamClient = {
    requestStream: async (params: RequestStreamParams): Promise<StreamSession> => {
      const response = await fetch(`${brokerUrl}/stream/session`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          renderUrl: params.renderUrl,
          renderOptions: { ...DEFAULT_RENDER_OPTIONS, ...params.renderOptions },
          initialData: params.initialData,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to request stream (${response.status}): ${errorBody}`);
      }
      return response.json();
    },

    endStream: async (sessionId: string): Promise<void> => {
      const response = await fetch(`${brokerUrl}/stream/session/${sessionId}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status !== 404) {
          throw new Error(`Failed to end stream (${response.status}): ${errorBody}`);
        }
      }
    },

    sendEvent: async (sessionId: string, event: InputStreamEvent): Promise<void> => {
      const response = await fetch(`${brokerUrl}/stream/session/${sessionId}/input`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to send event (${response.status}): ${errorBody}`);
      }
    },

    updateStream: async (sessionId: string, updates: { renderOptions?: RenderOptions, sceneData?: any }): Promise<void> => {
      const response = await fetch(`${brokerUrl}/stream/session/${sessionId}`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to update stream (${response.status}): ${errorBody}`);
      }
    },

    createRenderStream: (params: Omit<CreateRenderStreamParams, 'client'>): RenderStream => {
      return createRenderStream({ ...params, client });
    }
  };

  return client;
}

/**
 * Creates a higher-level stream management instance, potentially wrapping StreamClient.
 * This is likely what the React context will use.
 */
export interface RenderStream {
  readonly id: string;
  readonly url: string;
  readonly state: StreamState;
  start: () => Promise<void>;
  end: () => Promise<void>;
  send: (event: InputStreamEvent) => void;
  update: (updates: { renderOptions?: RenderOptions, sceneData?: any }) => Promise<void>;
  subscribe: (listener: (state: StreamState) => void) => () => void;
  getVideoElement: () => HTMLVideoElement | null;
  destroy: () => void; // Added cleanup method
}

export interface CreateRenderStreamParams {
  url: string;
  initialData?: Record<string, any>;
  renderOptions?: RenderOptions;
  client: StreamClient; // Require a pre-configured client
  autoConnect?: boolean; // Automatically call start()?
}

function createRenderStream(params: CreateRenderStreamParams): RenderStream {
  const { client, url, initialData, renderOptions, autoConnect = true } = params;
  const streamId = `render-stream-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  let sessionId: string | null = null;
  let videoElement: HTMLVideoElement | null = null;
  let peerConnection: RTCPeerConnection | null = null;
  let signalingSocket: WebSocket | null = null;
  let currentState: StreamState = { status: 'initializing' };
  const stateListeners = new Set<(state: StreamState) => void>();
  let stateUpdateSubscription: (() => void) | null = null; // If client provided direct state sub
  let isDestroyed = false;

  const setState = (newState: Partial<StreamState>) => {
    if (isDestroyed) return;
    const updatedState = { ...currentState, ...newState };
    // Prevent unnecessary updates if state hasn't changed
    if (JSON.stringify(currentState) === JSON.stringify(updatedState)) {
        return;
    }
    currentState = updatedState;
    // Use Array.from for safe iteration while potentially modifying the set
    Array.from(stateListeners).forEach(l => l(currentState));
  };

  const setupWebRTC = (session: StreamSession) => {
    if (isDestroyed || !session.iceServers || !session.signalingUrl) {
        setState({ status: 'error', errorMessage: 'Missing ICE servers or signaling URL for WebRTC setup' });
        return;
    }

    console.log(`[${streamId}] Setting up WebRTC for session: ${session.sessionId}`);
    peerConnection = new RTCPeerConnection({ iceServers: session.iceServers });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        console.log(`[${streamId}] Sending ICE candidate`);
        signalingSocket.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`[${streamId}] WebRTC Connection State: ${peerConnection?.connectionState}`);
      switch (peerConnection?.connectionState) {
        case 'connected':
          setState({ status: 'streaming' });
          break;
        case 'disconnected':
        case 'failed':
          setState({ status: 'reconnecting' }); // Or potentially error/ended
          // TODO: Implement reconnection logic?
          break;
        case 'closed':
          setState({ status: 'ended' });
          break;
      }
    };

    peerConnection.ontrack = (event) => {
      console.log(`[${streamId}] Track received:`, event.track.kind);
      if (event.track.kind === 'video') {
        if (!videoElement) {
          videoElement = document.createElement('video');
          videoElement.playsInline = true;
          videoElement.autoplay = true;
          videoElement.muted = true; // Usually needed for autoplay
          console.log(`[${streamId}] Video element created.`);
        }
        if (videoElement.srcObject !== event.streams[0]) {
          videoElement.srcObject = event.streams[0];
          console.log(`[${streamId}] Video stream attached to element.`);
        }
      }
      // Handle audio tracks similarly if needed
    };

    // Add transceiver for receiving video
    peerConnection.addTransceiver('video', { direction: 'recvonly' });
    // peerConnection.addTransceiver('audio', { direction: 'recvonly' });

    // --- Signaling --- 
    console.log(`[${streamId}] Connecting to signaling server: ${session.signalingUrl}`);
    signalingSocket = new WebSocket(session.signalingUrl);

    signalingSocket.onopen = () => {
      console.log(`[${streamId}] Signaling connection opened.`);
      // Potentially send an initial message if required by protocol
    };

    signalingSocket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`[${streamId}] Received signaling message:`, message.type);

        if (message.type === 'offer') {
          await peerConnection?.setRemoteDescription(new RTCSessionDescription(message.sdp));
          const answer = await peerConnection?.createAnswer();
          if (answer) {
            await peerConnection?.setLocalDescription(answer);
            console.log(`[${streamId}] Sending SDP answer`);
            signalingSocket?.send(JSON.stringify({ type: 'answer', sdp: answer }));
          }
        } else if (message.type === 'ice-candidate') {
          if (message.candidate) {
            await peerConnection?.addIceCandidate(new RTCIceCandidate(message.candidate));
          } 
        } else if (message.type === 'error') {
            console.error(`[${streamId}] Signaling server error:`, message.message);
            setState({ status: 'error', errorMessage: `Signaling error: ${message.message}` });
            closeConnections();
        }
      } catch (error) {
        console.error(`[${streamId}] Error handling signaling message:`, error);
        setState({ status: 'error', errorMessage: 'Failed to handle signaling message' });
        closeConnections();
      }
    };

    signalingSocket.onerror = (error) => {
      console.error(`[${streamId}] Signaling WebSocket error:`, error);
      setState({ status: 'error', errorMessage: 'Signaling connection failed' });
      closeConnections();
    };

    signalingSocket.onclose = () => {
      console.log(`[${streamId}] Signaling connection closed.`);
      // Don't immediately set to ended here, PeerConnection state change handles it
      if (currentState.status !== 'ended' && currentState.status !== 'error') {
          // If closed unexpectedly, maybe attempt reconnect or set error/reconnecting state
          // setState({ status: 'reconnecting', errorMessage: 'Signaling connection lost' });
      }
    };
  };

  const closeConnections = () => {
      if (signalingSocket) {
        signalingSocket.onclose = null; // Prevent onclose handler logic during manual close
        signalingSocket.close();
        signalingSocket = null;
      }
      if (peerConnection) {
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.ontrack = null;
        peerConnection.close();
        peerConnection = null;
      }
      if (videoElement) {
          videoElement.srcObject = null;
          // Don't remove the element itself, let the UI handle that
          videoElement = null;
      }
      console.log(`[${streamId}] Connections closed.`);
  }

  const renderStreamInstance: RenderStream = {
    id: streamId,
    url: url,
    get state() { return currentState; }, // Getter for read-only state

    start: async () => {
      if (isDestroyed) {
        console.warn(`[${streamId}] Cannot start, instance is destroyed.`);
        return;
      }
      if (sessionId || currentState.status === 'connecting' || currentState.status === 'streaming') {
        console.warn(`[${streamId}] Stream already started or starting.`);
        return;
      }
      setState({ status: 'connecting' });
      try {
        console.log(`[${streamId}] Requesting stream session...`);
        const session = await client.requestStream({
          renderUrl: url,
          renderOptions: renderOptions,
          initialData: initialData,
        });
        sessionId = session.sessionId;
        console.log(`[${streamId}] Session obtained: ${sessionId}`);

        // If client provides direct state subscription, use it
        // Otherwise, rely on WebRTC state changes + signaling
        // Example: if (client.subscribeToState) { stateUpdateSubscription = client.subscribeToState(...) }

        setupWebRTC(session);
        // State will transition based on WebRTC/Signaling events
      } catch (error: any) {
        console.error(`[${streamId}] Failed to start stream:`, error);
        setState({ status: 'error', errorMessage: error.message || 'Unknown error starting stream' });
        sessionId = null;
        closeConnections();
      }
    },

    end: async () => {
      if (isDestroyed) return;
      if (!sessionId) {
          console.log(`[${streamId}] Stream not active, cannot end.`);
          // Ensure state is consistent if end() is called early
          if (currentState.status !== 'ended' && currentState.status !== 'error') {
             setState({ status: 'ended' });
          }
          closeConnections(); // Clean up any partial connections
          return;
      }
      console.log(`[${streamId}] Ending stream session: ${sessionId}`);
      const currentSessionId = sessionId;
      sessionId = null; // Prevent further actions
      closeConnections();
      try {
        await client.endStream(currentSessionId);
        setState({ status: 'ended' });
      } catch (error: any) {
        console.error(`[${streamId}] Failed to cleanly end stream on server:`, error);
        // State is already set to ended locally
        setState({ status: 'ended', errorMessage: `Error during server cleanup: ${error.message}` }); // Add error message but keep state as ended
      }
    },

    send: (event: InputStreamEvent) => {
      if (isDestroyed) return;
      if (!sessionId || currentState.status !== 'streaming') {
        console.warn(`[${streamId}] Cannot send event, stream not active or not streaming.`);
        return;
      }
      client.sendEvent(sessionId, event).catch(err => {
          console.error(`[${streamId}] Failed to send event:`, err);
          // Optional: set error state?
      });
    },

    update: async (updates: { renderOptions?: RenderOptions, sceneData?: any }) => {
        if (isDestroyed) return;
        if (!sessionId) {
            console.warn(`[${streamId}] Cannot update, stream not active.`);
            throw new Error("Stream not active");
        }
        console.log(`[${streamId}] Requesting stream update:`, updates);
        try {
            await client.updateStream(sessionId, updates);
            // The server *might* send back new state via signaling/SSE,
            // or the client might need to update based on ack.
            // For now, assume update happens server-side.
        } catch (error: any) {
            console.error(`[${streamId}] Failed to update stream:`, error);
            setState({ status: 'error', errorMessage: `Update failed: ${error.message}`});
            throw error; // Re-throw so caller knows update failed
        }
    },

    subscribe: (listener: (state: StreamState) => void): (() => void) => {
      stateListeners.add(listener);
      listener(currentState); // Notify immediately
      return () => {
        stateListeners.delete(listener);
      };
    },

    getVideoElement: () => videoElement,

    destroy: () => {
        if (isDestroyed) return;
        console.log(`[${streamId}] Destroying RenderStream instance.`);
        isDestroyed = true;
        stateListeners.clear();
        if (stateUpdateSubscription) {
            stateUpdateSubscription();
            stateUpdateSubscription = null;
        }
        if (sessionId) {
            renderStreamInstance.end(); // Attempt to end the stream cleanly
        } else {
            closeConnections(); // Ensure connections are closed if no session ID
        }
    }
  };

  if (autoConnect) {
    // Use setTimeout to allow subscribers to attach in the same tick
    setTimeout(() => renderStreamInstance.start(), 0);
  }

  return renderStreamInstance;
} 