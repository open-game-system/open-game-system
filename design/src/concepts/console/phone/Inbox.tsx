// Every game with turns, one list: whose move it is, across Word Duel and game nights alike.
// Grouped by who has to act, like a good async games list; finished and closed games sink.
import type { Store } from "../../../harness/store";
import { finished, inbox, waiting } from "../inbox";
import { goHome, type S } from "../state";
import { StatusBar } from "../ui/Brand";
import { Chevron } from "../ui/Icons";
import { Lane } from "../ui/Lane";
import { TurnRow, TurnRows } from "./TurnRows";

export function Inbox({ s, store }: { s: S; store: Store<S> }) {
  const mine = inbox(s);
  return (
    <div className="cx-phone">
      <StatusBar dark />
      <div className="cx-topbar">
        <button className="cx-back" data-bot="inbox-home" onClick={() => store.update(goHome)}>
          <Chevron size={20} dir="left" /> Home
        </button>
      </div>
      <div className="cx-scroll">
        <h1 className="cx-title cx-title--page">Every game</h1>
        <Lane id="turns" title="Your turn" count={mine.length}>
          <TurnRows items={mine} store={store} />
        </Lane>
        <Lane id="waiting" title="Waiting on them">
          <ul className="cx-rows">
            {waiting(s).map((t) => (
              <TurnRow key={t.id} item={t} store={store} />
            ))}
          </ul>
        </Lane>
        <Lane id="done" title="Finished">
          <ul className="cx-rows cx-rows--quiet">
            {finished(s).map((t) => (
              <TurnRow key={t.id} item={t} store={store} />
            ))}
          </ul>
        </Lane>
      </div>
    </div>
  );
}
