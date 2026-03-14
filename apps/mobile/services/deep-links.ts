import * as Linking from "expo-linking";

/**
 * Registered game domains that should be opened directly in the app.
 * When the app intercepts a Universal Link from one of these domains,
 * the full URL is treated as the game URL.
 */
const GAME_DOMAINS = ["triviajam.tv"];

/**
 * The default game domain to use when a custom scheme URL has a game path
 * but no hostname (e.g., myapp://games/abc123 → https://triviajam.tv/games/abc123)
 */
const DEFAULT_GAME_DOMAIN = "triviajam.tv";

/**
 * Path prefixes on game domains that should open in the app.
 * Other paths (e.g., homepage) are not game links.
 */
const GAME_PATH_PREFIXES = ["/games/", "/spectate/"];

/**
 * Extract the game URL from an incoming deep link or Universal Link.
 *
 * Supported formats:
 *   - Universal Link: https://opengame.org/open?url=<encoded_url>
 *   - Custom scheme:  myapp://open?url=<encoded_url>
 *   - Direct game link: https://triviajam.tv/games/<id>
 *   - Direct spectate link: https://triviajam.tv/spectate/<id>
 *   - Custom scheme game path: myapp://games/<id> (from universal link conversion)
 *
 * Returns the decoded game URL or null if none found.
 */
export function extractGameUrl(incomingUrl: string): string | null {
  try {
    const parsed = Linking.parse(incomingUrl);

    // Check for direct game domain links (e.g., triviajam.tv/games/abc123)
    if (parsed.hostname && GAME_DOMAINS.includes(parsed.hostname)) {
      const path = parsed.path?.startsWith("/") ? parsed.path : `/${parsed.path}`;
      if (GAME_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        return incomingUrl;
      }
      return null;
    }

    // Check if this is an /open path with a url parameter
    if (parsed.path === "open" || parsed.path === "/open") {
      const gameUrl = parsed.queryParams?.url;
      if (typeof gameUrl === "string" && gameUrl.length > 0) {
        return gameUrl;
      }
    }

    // Handle custom scheme with game path (e.g., myapp://games/abc123)
    // This happens when iOS converts a universal link to the app's custom scheme
    if (parsed.path) {
      const path = parsed.path.startsWith("/") ? parsed.path : `/${parsed.path}`;
      if (GAME_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        return `https://${DEFAULT_GAME_DOMAIN}${path}`;
      }
    }

    return null;
  } catch (error) {
    console.error("[DeepLinks] Failed to parse URL:", error);
    return null;
  }
}

/**
 * Get the initial URL that launched the app (cold start).
 */
export async function getInitialGameUrl(): Promise<string | null> {
  const initialUrl = await Linking.getInitialURL();
  if (!initialUrl) return null;
  console.log("[DeepLinks] Initial URL:", initialUrl);
  return extractGameUrl(initialUrl);
}

/**
 * Subscribe to incoming URLs while the app is running (warm start).
 * Returns an event subscription that should be cleaned up on unmount.
 */
export function addDeepLinkListener(
  callback: (gameUrl: string) => void
): ReturnType<typeof Linking.addEventListener> {
  return Linking.addEventListener("url", (event) => {
    console.log("[DeepLinks] Incoming URL:", event.url);
    const gameUrl = extractGameUrl(event.url);
    if (gameUrl) {
      callback(gameUrl);
    }
  });
}
