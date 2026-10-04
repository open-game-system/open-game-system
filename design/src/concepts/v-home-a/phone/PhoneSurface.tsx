import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import type { S } from "../state";
import { useCastClock, useNightClock, useSwitchClock } from "../sim";
import { useArrivalClock } from "./arrival";
import { StatusBar } from "../ui/Brand";
import { DuelGameView } from "../wordduel/DuelGame";
import { DuelList } from "../wordduel/DuelList";
import { FirstRun } from "./firstrun/FirstRun";
import { StartNewSheet } from "./StartNew";
import { Inbox } from "./Inbox";
import { WhoSheet } from "./WhoSheet";
import { LockScreen } from "./LockScreen";
import { NightPage } from "./night/NightPage";
import { Home } from "./Home";
import { InGame } from "./InGame";
import { LibraryView } from "./Library";
import { TabBar } from "./TabBar";
import { ConsoleMenu } from "./ConsoleMenu";

export function PhoneSurface({ store, shot }: { store: Store<S>; shot: boolean }) {
  const s = useStore(store);
  useSwitchClock(s, store, shot);
  useNightClock(s, store, shot);
  useCastClock(s, store, shot);
  useArrivalClock(s, store, shot);
  if (s.phone === "lock") return <LockScreen s={s} store={store} />;
  if (s.phone === "night") return <NightPage s={s} store={store} />;
  if (s.phone === "controller" && (s.onTv || s.switching)) return <InGame s={s} store={store} />;
  if (s.phone === "duels") return <DuelList s={s} store={store} />;
  if (s.phone === "duel") return <DuelGameView s={s} store={store} />;
  if (s.firstRun) {
    return (
      <div className="cx-phone cx-phone--setup">
        <StatusBar dark />
        <FirstRun s={s} store={store} shot={shot} />
      </div>
    );
  }
  return (
    <div className={`cx-phone ${s.textScale > 1 ? "cx-phone--dt" : ""}`}>
      <StatusBar dark />
      {s.phone === "inbox" ? <Inbox s={s} store={store} /> : s.tab === "library" ? <LibraryView s={s} store={store} /> : <Home s={s} store={store} />}
      {!s.who && !s.start && s.phone !== "inbox" && <TabBar s={s} store={store} />}
      {s.who && <WhoSheet s={s} store={store} />}
      {s.start && <StartNewSheet s={s} store={store} />}
      {s.menu && s.onTv && (
        <div className="cx-ingame rm-menuhost">
          <ConsoleMenu s={s} store={store} />
        </div>
      )}
    </div>
  );
}
