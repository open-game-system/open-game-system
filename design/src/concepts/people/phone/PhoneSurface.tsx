// The grown-up phone. It's also the session's host: the automatic beats of a swap run on its clock.
import { useEffect } from "react";
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import { advance, type S } from "../state";
import { PeopleHome } from "./PeopleHome";
import { PeopleEmpty } from "./PeopleEmpty";
import { CouchScreen } from "./CouchScreen";
import { DuelThread } from "./DuelThread";
import { DuelsList } from "./DuelsList";
import { Library } from "./Library";
import { UsThread } from "./UsThread";
import { GameNight } from "./GameNight";
import { Household } from "./Household";

const BEAT: Partial<Record<S["couch"]["phase"], number>> = { saving: 1400, cutover: 1700, following: 1000 };

export function PhoneSurface({ store, shot }: { store: Store<S>; shot: boolean }) {
  const s = useStore(store);
  const beat = BEAT[s.couch.phase];
  useEffect(() => {
    if (shot || beat === undefined) return;
    const t = setTimeout(() => store.update(advance), beat);
    return () => clearTimeout(t);
  }, [s.couch, beat, shot, store]);

  const p = s.phone;
  switch (p.kind) {
    case "people":
      return <PeopleHome s={s} store={store} />;
    case "people-empty":
      return <PeopleEmpty store={store} />;
    case "couch":
      return <CouchScreen s={s} store={store} />;
    case "duel":
      return <DuelThread s={s} store={store} duelId={p.duelId} from={p.from} />;
    case "duels":
      return <DuelsList s={s} store={store} />;
    case "library":
      return <Library s={s} store={store} />;
    case "us":
      return <UsThread s={s} store={store} />;
    case "game-night":
      return <GameNight store={store} />;
    case "household":
      return <Household s={s} store={store} />;
  }
}
