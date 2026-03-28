// Export the new client-based API

export { createStreamClient } from "./client";
// Legacy exports (deprecated)
export { createStreamKitRouter } from "./router";
export { StreamKitServer } from "./server";
export type {
  RenderStreamConfig,
  StateChange,
  StreamKitHooks,
  StreamKitServerConfig,
  StreamSession,
} from "./types";
