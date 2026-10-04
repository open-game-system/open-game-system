// Phone home, "Family table": led by who's here tonight. A line says who's at the table; the table
// holds the family's chairs, the game on the TV (glowing) and the other games; other homes get a
// place set; turns waiting on you are cards in your hand. The library is a tab.
import type { Store } from "../../../harness/store";
import { HOME } from "../../../world";
import type { S } from "../state";
import { hereTonight } from "../state";
import { Wordmark } from "../ui/Brand";
import { Crest } from "../ui/Sticker";
import { FamilyTable } from "./Table";
import { Hand } from "./Hand";

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

function whoLine(s: S): string {
  const here = hereTonight(s);
  const out = HOME.people.filter((p) => !s.here.includes(p.id));
  const n = here.length;
  const count = n === 0 ? "Nobody at the table yet" : `${n} at the table`;
  return out.length === 0 ? `${count} · everyone's home` : `${count} · ${out.map((p) => p.name).join(" & ")} out tonight`;
}

export function Home({ s, store }: { s: S; store: Store<S> }) {
  return (
    <div className="cx-scroll ft-home">
      <header className="ft-head">
        <h1>Friday at the Mumms' table</h1>
        <p>{whoLine(s)}</p>
      </header>
      <FamilyTable s={s} store={store} />
      {/* Under an open sheet the hand is covered; keep it out of the way. */}
      {!s.who && !s.start && <Hand s={s} store={store} />}
    </div>
  );
}
