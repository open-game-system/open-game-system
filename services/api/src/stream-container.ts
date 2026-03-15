import { Container } from "@cloudflare/containers";

/**
 * StreamContainer manages a headless Chrome instance that renders
 * a game's spectate URL and streams it via PeerJS/WebRTC.
 *
 * Each cast session gets its own container instance.
 * The container runs the stream-kit server on port 8080.
 */
export class StreamContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "5m"; // Auto-sleep after 5 minutes of no requests
  enableInternet = true; // Needs internet for PeerJS signaling + loading game URLs

  override onStart() {
    console.log("[StreamContainer] Container started");
  }

  override onStop() {
    console.log("[StreamContainer] Container stopped");
  }

  override onError(error: unknown) {
    console.error("[StreamContainer] Container error:", error);
  }
}
