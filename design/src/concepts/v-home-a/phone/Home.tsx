// Phone home, "Remote first": the phone IS the TV's remote. One thumb, bottom-heavy.
//   1. The screen: what the TV shows right now, as a big live tile, with its remote deck welded on
//      (pause · controller · swap). Tonight's people sit on the screen's corner.
//   2. Up next: a short stack of this household's couch games. One tap swaps the TV to it.
//   3. Waiting on you: every duel move and game-night roll as one strip of stickers.
// Everything a parent needs with a kid on their lap is in the lower two thirds of the glass.
import type { Store } from "../../../harness/store";
import { HOME } from "../../../world";
import type { S } from "../state";
import { Wordmark } from "../ui/Brand";
import { Crest } from "../ui/Sticker";
import { RemoteScreen } from "./remote/Screen";
import { UpNext } from "./remote/UpNext";
import { WaitingStrip } from "./remote/Waiting";

export function HomeHeader() {
  return (
    <header className="cx-head">
      <Wordmark size={22} />
      <button className="cx-household" aria-label="The Mumms household" data-bot="household">
        <Crest household={HOME} size={46} />
        <span className="cx-household__name">The Mumms</span>
      </button>
    </header>
  );
}

export function Home({ s, store }: { s: S; store: Store<S> }) {
  return (
    <div className="cx-scroll rm-home">
      <header className="rm-head">
        <Wordmark size={20} />
        <button className="rm-head__home" aria-label="The Mumms household" data-bot="household">
          <Crest household={HOME} size={40} />
        </button>
      </header>
      <RemoteScreen s={s} store={store} />
      <UpNext s={s} store={store} />
      <WaitingStrip s={s} store={store} />
    </div>
  );
}
