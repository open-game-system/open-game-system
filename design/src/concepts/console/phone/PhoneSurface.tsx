import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import type { S } from "../state";
import { useCastClock, useNightClock, useSwitchClock } from "../sim";
import { StatusBar } from "../ui/Brand";
import { DuelGameView } from "../wordduel/DuelGame";
import { DuelList } from "../wordduel/DuelList";
import { FirstRun } from "./FirstRun";
import { Inbox } from "./Inbox";
import { WhoSheet } from "./WhoSheet";
import { LockScreen } from "./LockScreen";
import { NightPage } from "./night/NightPage";
import { Home } from "./Home";
import { InGame } from "./InGame";
import { LibraryView } from "./Library";
import { TabBar } from "./TabBar";

export function PhoneSurface({ store, shot }: { store: Store<S>; shot: boolean }) {
  const s = useStore(store);
  useSwitchClock(s, store, shot);
  useNightClock(s, store, shot);
  useCastClock(s, store, shot);
  if (s.phone === "lock") return <LockScreen s={s} store={store} />;
  if (s.phone === "night") return <NightPage s={s} store={store} />;
  if (s.phone === "inbox") return <Inbox s={s} store={store} />;
  if (s.phone === "controller" && (s.onTv || s.switching)) return <InGame s={s} store={store} />;
  if (s.phone === "duels") return <DuelList s={s} store={store} />;
  if (s.phone === "duel") return <DuelGameView s={s} store={store} />;
  return (
    <div className="cx-phone">
      <StatusBar />
      {s.firstRun ? <FirstRun /> : s.tab === "library" ? <LibraryView s={s} store={store} /> : <Home s={s} store={store} />}
      {!s.firstRun && !s.who && <TabBar s={s} store={store} />}
      {s.who && <WhoSheet s={s} store={store} />}
    </div>
  );
}
