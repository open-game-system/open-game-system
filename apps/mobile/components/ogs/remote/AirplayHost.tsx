import { AirplaySheetHost } from "@open-game-system/shell/modules/airplay-ui";
import { useSyncExternalStore } from "react";
import { airplaySheet, castPrompt } from "../../../services/runtime";
import { airplayTheme } from "./airplay-theme";

/**
 * The AirPlay Screen Mirroring steps over the whole app (the TV tab's Cast, the TV picker). While
 * the cast prompt is up it shows the steps itself: iOS can't present two sheets side by side.
 */
export function AirplayHost() {
  const prompt = useSyncExternalStore(castPrompt.subscribe, castPrompt.get, castPrompt.get);
  return <AirplaySheetHost sheet={airplaySheet} hidden={prompt !== null} theme={airplayTheme} />;
}
