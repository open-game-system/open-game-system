import type { StreamState } from "@open-game-system/stream-kit-types";
import type { RenderStream } from "@open-game-system/stream-kit-web";
import {
  createContext,
  memo,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

interface StreamContextValue {
  stream: RenderStream;
}

const StreamContext = createContext<StreamContextValue | null>(null);
StreamContext.displayName = "StreamContext";

/**
 * Internal hook to access the stream instance
 * @returns The stream instance
 * @internal
 */
function useStream(): RenderStream {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error("useStream must be used within a StreamProvider");
  }
  return context.stream;
}

interface StreamStateStore {
  getSnapshot: () => StreamState;
  subscribe: (callback: () => void) => () => void;
}

/**
 * Create a store context for stream state to avoid unnecessary rerenders
 */
function createStreamStateContext() {
  const StateContext = createContext<StreamStateStore | null>(null);
  StateContext.displayName = "StreamStateContext";

  const Provider = memo(({ children }: { children: ReactNode }) => {
    const stream = useStream();
    
    const store = useMemo(() => ({
      subscribe: stream.subscribe.bind(stream),
      getSnapshot: () => stream.state,
    }), [stream]);

    return (
      <StateContext.Provider value={store}>
        {children}
      </StateContext.Provider>
    );
  });
  Provider.displayName = "StreamStateProvider";

  function useSelector<T>(selector: (state: StreamState) => T): T {
    const store = useContext(StateContext);
    if (!store) {
      throw new Error("useSelector must be used within a StreamState.Provider");
    }
    const memoizedSelector = useMemo(() => selector, [selector]);
    
    return useSyncExternalStore(
      store.subscribe,
      () => memoizedSelector(store.getSnapshot()),
      () => memoizedSelector(store.getSnapshot()) // Same for server
    );
  }

  // Helper components for common stream state patterns
  const Status = memo(({ children }: { children: (status: StreamState["status"]) => ReactNode }) => {
    const status = useSelector(state => state.status);
    return <>{children(status)}</>;
  });
  Status.displayName = "StreamStatus";

  const When = memo(({ 
    status, 
    children 
  }: { 
    status: StreamState["status"] | StreamState["status"][];
    children: ReactNode;
  }) => {
    const currentStatus = useSelector(state => state.status);
    const statuses = Array.isArray(status) ? status : [status];
    return statuses.includes(currentStatus) ? <>{children}</> : null;
  });
  When.displayName = "StreamWhen";

  const Stats = memo(({ children }: { children: (stats: { fps: number; latency: number }) => ReactNode }) => {
    const stats = useSelector(state => ({
      fps: state.fps || 0,
      latency: state.latency || 0
    }));
    return <>{children(stats)}</>;
  });
  Stats.displayName = "StreamStats";

  const Quality = memo(({ children }: { children: (quality: { resolution: string; bitrate: number }) => ReactNode }) => {
    const quality = useSelector(state => ({
      resolution: state.resolution || "unknown",
      bitrate: state.bitrate || 0
    }));
    return <>{children(quality)}</>;
  });
  Quality.displayName = "StreamQuality";

  const Match = memo(({ 
    when,
    children 
  }: { 
    when: (state: StreamState) => boolean;
    children: ReactNode;
  }) => {
    const matches = useSelector(when);
    return matches ? <>{children}</> : null;
  });
  Match.displayName = "StreamMatch";

  const Overlay = memo(({ 
    status,
    connecting,
    streaming,
    ended,
    error,
  }: { 
    status?: StreamState["status"] | StreamState["status"][];
    connecting?: ReactNode;
    streaming?: ReactNode;
    ended?: ReactNode;
    error?: ReactNode;
  }) => {
    const currentStatus = useSelector(state => state.status);
    const statuses = status ? (Array.isArray(status) ? status : [status]) : null;

    if (statuses && !statuses.includes(currentStatus)) {
      return null;
    }

    switch (currentStatus) {
      case "connecting":
        return connecting ? <>{connecting}</> : null;
      case "streaming":
        return streaming ? <>{streaming}</> : null;
      case "ended":
        return ended ? <>{ended}</> : null;
      case "error":
        return error ? <>{error}</> : null;
      default:
        return null;
    }
  });
  Overlay.displayName = "StreamOverlay";

  return {
    Provider,
    useSelector,
    Status,
    When,
    Stats,
    Quality,
    Match,
    Overlay,
  };
}

/**
 * Component that renders the video stream
 */
const StreamCanvas = memo(
  ({ className, ...props }: React.VideoHTMLAttributes<HTMLVideoElement>) => {
    const stream = useStream();
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      const videoElement = stream.getVideoElement();
      const currentVideoRef = videoRef.current;

      if (videoElement && currentVideoRef && currentVideoRef.parentNode) {
        if (currentVideoRef !== videoElement) {
          currentVideoRef.parentNode.replaceChild(videoElement, currentVideoRef);
        }
      }
    }, [stream]);

    return (
      <video
        ref={videoRef}
        className={className}
        {...props}
        playsInline
        autoPlay
        muted
      />
    );
  }
);
StreamCanvas.displayName = "StreamCanvas";

const StreamProvider = memo(
  ({ children, stream }: { children: ReactNode; stream: RenderStream }) => {
    const value = useMemo(() => ({ stream }), [stream]);
    const StreamState = useMemo(() => createStreamStateContext(), []);

    return (
      <StreamContext.Provider value={value}>
        <StreamState.Provider>
          {children}
        </StreamState.Provider>
      </StreamContext.Provider>
    );
  }
);
StreamProvider.displayName = "StreamProvider";

// Export everything directly
export {
  createStreamStateContext, StreamCanvas, StreamProvider, useStream
};
