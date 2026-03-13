import type { Operation } from 'fast-json-patch';

// Core types for Stream Kit based on OGS Spec and Drafts

/**
 * Options for configuring the rendering quality and behavior.
 */
export interface RenderOptions {
  resolution?: "720p" | "1080p" | "1440p" | "4k" | string; // e.g., "1920x1080"
  targetFps?: number;
  quality?: "low" | "medium" | "high" | "ultra";
  priority?: "latency" | "quality";
  region?: string; // Preferred cloud region (e.g., "us-central1")
}

/**
 * Represents the real-time state of a streaming session.
 */
export interface StreamState {
  status: "initializing" | "connecting" | "streaming" | "reconnecting" | "error" | "ended";
  latency?: number; // Estimated round-trip latency in ms
  resolution?: string; // Actual streaming resolution
  fps?: number; // Current frames per second
  bitrate?: number; // Current bitrate in bps
  errorMessage?: string;
  errorCode?: string; // Optional error code
}

/**
 * Represents the configuration and status of a stream session from the client's perspective.
 */
export interface StreamSession {
  sessionId: string;
  status: StreamState["status"];
  signalingUrl?: string; // WebSocket URL for WebRTC negotiation
  iceServers?: RTCIceServer[];
  estimatedStartTime?: number; // ms until stream should begin
  region?: string; // Actual region assigned
  error?: string; // Error message if session creation failed
}

/**
 * Generic event structure for communication (client -> server or server -> client via custom channels).
 */
export interface StreamEvent {
  type: string;
  payload?: any;
}

/**
 * Specific input event types that might be forwarded from client to server.
 */
export type InputStreamEvent = StreamEvent & ({
  type: "interaction";
  data: {
    action: string; // e.g., 'click', 'keypress', 'select'
    position?: { x: number; y: number };
    key?: string;
    entityId?: string;
    [key: string]: any; // Allow additional custom data
  };
} | {
  type: "command";
  data: {
    command: string;
    args?: any[];
  };
});

/**
 * Represents the state object maintained by the stream-kit-server for each session.
 * Includes details needed for server-side management.
 */
export interface ServerStreamSessionState extends StreamState {
  streamId: string;
  targetUrl: string;
  clientConnected: boolean; // Is there an active SSE connection?
  instanceInfo?: { // Info about the browser instance
    pid?: number;
    startTime: number;
    viewport: { width: number; height: number };
  };
  webrtc?: { // State related to WebRTC setup
    signalingState: 'idle' | 'negotiating' | 'connected' | 'failed';
    iceGatheringState?: RTCIceGatheringState;
    connectionState?: RTCPeerConnectionState;
  };
  callerContext?: Record<string, any>; // Context from the initial request validation
  metadata?: Record<string, any>; // Other dynamic metadata
  lastActivityTime: number;
}

/**
 * Type for JSON Patch operations (RFC 6902).
 */
export type StatePatchOperation = Operation;

/**
 * Parameters for requesting a new stream session.
 */
export interface RequestStreamParams {
  renderUrl: string;
  renderOptions?: RenderOptions;
  initialData?: Record<string, any>;
}

/**
 * Parameters for creating a render stream.
 */
export interface CreateRenderStreamParams {
  url: string;
  initialData?: Record<string, any>;
  renderOptions?: RenderOptions;
  autoConnect?: boolean;
}

/**
 * Interface for a render stream instance.
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
  destroy: () => void;
}

/**
 * Core client interface for interacting with the OGS Stream API.
 */
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