// Export the new client-based API
export { StreamKitServer } from "./server";
export { createStreamClient } from "./client";
export type { 
  StreamKitServerConfig,
  StreamSession,
  RenderStreamConfig
} from "./types";

// Legacy exports (deprecated)
export { createStreamKitRouter } from "./router";
export type { StreamKitHooks, StateChange } from "./types"; 