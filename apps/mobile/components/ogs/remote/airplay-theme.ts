import type { ShowOnTvTheme } from "@open-game-system/shell/modules/airplay-ui";
import { colors } from "../theme";

/** The AirPlay Screen Mirroring steps in the OGS app's dusk palette. */
export const airplayTheme: ShowOnTvTheme = {
  sheet: colors.dusk1,
  text: colors.cream,
  muted: colors.cream3,
  accent: colors.lamp,
  onAccent: colors.ink,
  panel: colors.dusk2,
};
