// First run (flow 1): welcome → the TV → who plays here (and their stickers) → the kids' iPads →
// ready. One stop per screen, on the same dotted path.
import type { Store } from "../../../../harness/store";
import type { S } from "../../state";
import { IpadStep } from "./IpadStep";
import { PeopleStep } from "./PeopleStep";
import { Ready } from "./Ready";
import { TvStep } from "./TvStep";
import { Welcome } from "./Welcome";

export function FirstRun({ s, store, shot }: { s: S; store: Store<S>; shot: boolean }) {
  switch (s.setup.step) {
    case "welcome":
      return <Welcome store={store} />;
    case "tv":
      return <TvStep s={s} store={store} shot={shot} />;
    case "people":
      return <PeopleStep s={s} store={store} />;
    case "ipads":
      return <IpadStep s={s} store={store} />;
    case "ready":
      return <Ready s={s} store={store} />;
  }
}
