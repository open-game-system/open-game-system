import { Redirect, useGlobalSearchParams } from "expo-router";
import { useEffect } from "react";
import { setGameUrl } from "../services/game-url-store";

const GAME_PATH_PREFIXES = ["/games/", "/spectate/"];
const DEFAULT_GAME_DOMAIN = "triviajam.tv";

/**
 * Catch-all route for deep links that Expo Router doesn't have a screen for.
 * When a universal link like triviajam.tv/games/xyz opens the app, Expo Router
 * converts it to opengame://games/xyz and tries to match a route. This catch-all
 * intercepts it, extracts the game URL, and redirects to the home screen
 * which will navigate to the game screen via the game-url-store subscription.
 */
export default function CatchAll() {
  const params = useGlobalSearchParams();

  useEffect(() => {
    const segments = params.unmatched;
    if (Array.isArray(segments)) {
      const path = "/" + segments.join("/");
      if (GAME_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        setGameUrl(`https://${DEFAULT_GAME_DOMAIN}${path}`);
      }
    }
  }, [params.unmatched]);

  return <Redirect href="/" />;
}
