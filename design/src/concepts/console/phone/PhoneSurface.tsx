import { useEffect } from "react";
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import { answerInvites, passTurn, US } from "../nights";
import { advance, type S } from "../state";
import { StatusBar } from "../ui/Brand";
import { DuelGameView } from "../wordduel/DuelGame";
import { DuelList } from "../wordduel/DuelList";
import { FirstRun } from "./FirstRun";
import { Inbox } from "./Inbox";
import { LockScreen } from "./LockScreen";
import { NightPage } from "./night/NightPage";
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

/**
 * The other homes' side of a game night, played by the prototype: invited homes answer a beat after
 * the invite goes out, and while a night is live the other homes take their rolls until it's ours.
 */
function useNightClock(s: S, store: Store<S>, shot: boolean) {
  const n = s.nights.list.find((x) => x.id === s.nights.open);
  const answering = !!n && n.status === "setup" && n.homes.some((h) => h.reply === "invited");
  const rolling = s.phone === "night" && !!n && n.status === "live" && n.turnOf !== US ? `${n.id}:${n.turn}` : null;
  useEffect(() => {
    if (shot || !answering) return;
    const t = setTimeout(() => store.update((x) => ({ ...x, nights: answerInvites(x.nights) })), 2600);
    return () => clearTimeout(t);
  }, [answering, shot, store]);
  useEffect(() => {
    if (shot || !rolling) return;
    const id = rolling.split(":")[0] ?? "";
    const t = setTimeout(() => store.update((x) => ({ ...x, nights: passTurn(x.nights, id) })), 2200);
    return () => clearTimeout(t);
  }, [rolling, shot, store]);
}

export function PhoneSurface({ store, shot }: { store: Store<S>; shot: boolean }) {
  const s = useStore(store);
  useSwitchClock(s, store, shot);
  useNightClock(s, store, shot);
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
      {!s.firstRun && <TabBar s={s} store={store} />}
    </div>
  );
}
