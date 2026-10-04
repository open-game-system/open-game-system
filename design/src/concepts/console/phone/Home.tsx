// Phone home: three lanes, one system. "On the TV tonight" (the couch session) · "Your turn" (every
// game waiting on you, one inbox) · "Game nights" (games across homes). The library is a tab.
import type { Store } from "../../../harness/store";
import { HOME } from "../../../world";
import type { S } from "../state";
import { Portrait, Wordmark } from "../ui/Brand";
import { Lane } from "../ui/Lane";
import { NightsLane } from "./NightsLane";
import { CouchRail, NowPlaying } from "./NowPlaying";
import { TurnRows } from "./TurnRows";
import { everyGame } from "../inbox";
import { Chevron } from "../ui/Icons";

export function HomeHeader() {
  return (
    <header className="cx-head">
      <Wordmark size={22} />
      <button className="cx-household" aria-label="The Mumms household">
        <span className="cx-household__faces">
          {HOME.people.map((p) => (
            <Portrait key={p.id} person={p} size={24} ring={false} />
          ))}
        </span>
        The Mumms
      </button>
    </header>
  );
}

export function Home({ s, store }: { s: S; store: Store<S> }) {
  const all = everyGame(s);
  const turns = all.yours;
  const others = all.theirs.length + all.paused.length;
  return (
    <div className="cx-scroll">
      <HomeHeader />
      <Lane id="tv" title="On the TV tonight">
        <NowPlaying s={s} store={store} />
        <CouchRail s={s} store={store} />
      </Lane>
      <Lane
        id="turns"
        title="Your turn"
        count={turns.length}
        action={
          <button className="cx-lane__more" data-bot="inbox-all" onClick={() => store.update((x) => ({ ...x, phone: "inbox" }))}>
            All turns <Chevron size={16} />
          </button>
        }
      >
        <TurnRows items={turns.slice(0, 2)} store={store} />
        {others > 0 && <p className="cx-lane__foot">{others} more waiting on other people, in All turns.</p>}
      </Lane>
      <NightsLane s={s} store={store} />
    </div>
  );
}
