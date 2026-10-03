// The grown-up phone: whatever is above the spine (a game's own view, the deck, a sheet), then
// the ledge when OGS has one thing to say, then the spine.
import type { ComponentType } from "react";
import type { Store } from "../../../harness/store";
import { DuelBoard } from "../duel/DuelBoard";
import { DuelList } from "../duel/DuelList";
import { NewDuel } from "../duel/NewDuel";
import { BakeReader, GenericGame, RocketCaptain } from "../games/phone";
import { game, useSwapDriver } from "../session";
import type { S } from "../state";
import { Deck } from "./Deck";
import { FirstRun } from "./FirstRun";
import { Ledge } from "./Ledge";
import { Seats } from "./Seats";
import { Spine } from "./Spine";
import { SwapProgress } from "./SwapProgress";

/** The games' own grown-up views (their web content). Anything else gets a generic frame. */
const VIEWS: Record<string, ComponentType> = {
  "rocket-crew": RocketCaptain,
  "bake-shop": () => <BakeReader reader="Jonathan" />,
};

export function Phone({ s, store, shot }: { s: S; store: Store<S>; shot: boolean }) {
  useSwapDriver(store, s.swap, shot);
  return (
    <div className="sp-root" data-shot={shot ? "1" : undefined} style={{ display: "flex", flexDirection: "column", background: "var(--sp-ink)" }}>
      <main style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
        <Body s={s} store={store} />
      </main>
      <Ledge s={s} store={store} />
      <Spine s={s} store={store} />
    </div>
  );
}

function Body({ s, store }: { s: S; store: Store<S> }) {
  if (s.firstRun) return <FirstRun s={s} store={store} />;
  if (s.swap === "saving" || s.swap === "cutover" || s.swap === "following") return <SwapProgress s={s} />;
  switch (s.phone) {
    case "home":
      return <Deck s={s} store={store} fromGame={false} />;
    case "deck":
      return <Deck s={s} store={store} fromGame />;
    case "seats":
      return <Seats s={s} store={store} />;
    case "duel-list":
      return <DuelList s={s} store={store} />;
    case "duel-board":
      return <DuelBoard s={s} store={store} />;
    case "duel-new":
      return <NewDuel s={s} store={store} />;
    case "game": {
      const View = VIEWS[s.current];
      return View ? <View /> : <GenericGame g={game(s.current)} />;
    }
  }
}
