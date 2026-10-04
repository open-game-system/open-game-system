// Phone home: the activity deck (Deck.tsx). One ordering of every open game, what needs you now
// first; the same order as a compact list is the "inbox" view. The library is a tab.
import type { Store } from "../../../harness/store";
import { HOME } from "../../../world";
import type { S } from "../state";
import { Wordmark } from "../ui/Brand";
import { Crest } from "../ui/Sticker";
import { Deck } from "./Deck";

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

export function Home({ s, store, list = false }: { s: S; store: Store<S>; list?: boolean }) {
  return <Deck s={s} store={store} list={list} />;
}
