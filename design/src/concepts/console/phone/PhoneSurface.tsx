import { useEffect } from "react";
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import { advance, type S } from "../state";
import { StatusBar } from "../ui/Brand";
import { DuelGameView } from "../wordduel/DuelGame";
import { DuelList } from "../wordduel/DuelList";
import { FirstRun } from "./FirstRun";
import { Home } from "./Home";
import { InGame } from "./InGame";
import { LibraryView } from "./Library";
import { TabBar } from "./TabBar";

/** The phone drives the switch's timeline (one clock for the whole session; frozen in shots). */
function useSwitchClock(s: S, store: Store<S>, shot: boolean) {
  const phase = s.switching?.phase;
  useEffect(() => {
    if (shot || !phase) return;
    const t = setTimeout(() => store.update(advance), phase === "saving" ? 1300 : 1500);
    return () => clearTimeout(t);
  }, [phase, shot, store]);
}

export function PhoneSurface({ store, shot }: { store: Store<S>; shot: boolean }) {
  const s = useStore(store);
  useSwitchClock(s, store, shot);
  if (s.phone === "controller" && (s.onTv || s.switching)) return <InGame s={s} store={store} />;
  if (s.phone === "duels") return <DuelList s={s} store={store} />;
  if (s.phone === "duel") return <DuelGameView s={s} store={store} />;
  return (
    <div className="cx-phone">
      <StatusBar />
      {s.firstRun ? <FirstRun /> : s.tab === "library" ? <LibraryView s={s} store={store} /> : <Home s={s} store={store} />}
      {!s.firstRun && <TabBar s={s} store={store} />}
    </div>
  );
}
