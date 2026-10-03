import type { Store } from "../../../harness/store";
import type { S } from "../state";
import { Home } from "./Home";
import { Schedule } from "./Schedule";
import { Director } from "./Director";
import { Controller } from "./Controller";
import { FirstRun } from "./FirstRun";
import { DuelList } from "../duel/List";
import { DuelBoard } from "../duel/Board";
import { NewGame } from "../duel/NewGame";

export function Phone({ s, store }: { s: S; store: Store<S> }) {
  switch (s.phone) {
    case "home":
      return <Home s={s} store={store} />;
    case "schedule":
      return <Schedule s={s} store={store} />;
    case "director":
      return <Director s={s} store={store} />;
    case "controller":
      return <Controller s={s} store={store} />;
    case "first-run":
      return <FirstRun store={store} />;
    case "duel-list":
      return <DuelList s={s} store={store} />;
    case "duel-board":
      return <DuelBoard s={s} store={store} />;
    case "duel-new":
      return <NewGame s={s} store={store} />;
  }
}
