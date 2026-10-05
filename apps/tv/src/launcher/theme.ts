import type { Manifest, SessionState } from "@open-game-system/ogs-protocol";
import type { HomeModel } from "./home";

/**
 * PS5-style: on Home, the focused game plays its music theme (`art.theme`). A focused icon or
 * sitting card is one game; Surprise me is silence (it would give the pick away), and so is every
 * other screen: a game's page, Getting ready, a game running.
 */
export function themeFor(input: {
  screen: SessionState["screen"];
  focus: string | null;
  home: HomeModel;
  games: readonly Manifest[];
}): string | null {
  if (input.screen !== "home") return null;
  const { focus, home } = input;
  const icon = home.icons.find((i) => i.itemId === focus);
  const card = home.cards.find((c) => c.itemId === focus);
  const appId = icon?.appId ?? (card?.kind === "sitting" ? card.appId : null);
  return input.games.find((g) => g.appId === appId)?.art.theme ?? null;
}
