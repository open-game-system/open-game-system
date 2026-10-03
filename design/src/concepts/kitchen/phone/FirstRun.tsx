// First evening: the table is empty. Set the places once, and every game knows who's who.
import type { Store } from "../../../harness/store";
import { personOf } from "../household";
import { PlaceCard } from "../ui/PlaceCard";
import { StatusBar, Wordmark } from "../ui/Bits";
import { Plus, Shield, TvGlyph } from "../ui/Icons";
import type { S } from "../state";

export function FirstRun({ s }: { s: S; store: Store<S> }) {
  return (
    <div className="pl pl-phone">
      <StatusBar time={s.clock} />
      <div className="pl-scroll">
        <header className="pl-home-head">
          <div>
            <Wordmark />
            <h1 className="pl-h1">Set the table</h1>
            <p className="pl-sub">Tell Porchlight who lives here, once. Every game will know who's who.</p>
          </div>
        </header>
        <div className="pl-couch pl-couch--empty">
          <PlaceCard person={personOf("dad")} line="This phone" />
          <EmptyPlace label="A grown-up" bot="add-grownup" />
          <EmptyPlace label="A kid" bot="add-kid" />
          <EmptyPlace label="A little one" bot="add-little" />
        </div>
        <ul className="pl-firstrun">
          <li>
            <TvGlyph size={22} />
            <span>
              <b>Pair the TV once.</b> Cast from here and every game opens on it, no codes to scan.
            </span>
          </li>
          <li>
            <Shield size={22} />
            <span>
              <b>Kids don't need accounts.</b> Hand them an iPad, pick their name on your phone, done. It follows whatever's on the TV.
            </span>
          </li>
        </ul>
        <div className="pl-firstrun-cta">
          <button className="pl-btn pl-btn--primary pl-wide" data-bot="add-someone">
            <span>
              <Plus size={18} /> Add someone to the table
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyPlace({ label, bot }: { label: string; bot: string }) {
  return (
    <button className="pl-place pl-place--empty" data-bot={bot}>
      <span className="pl-place-spacer" />
      <span className="pl-place-card">
        <Plus size={20} />
        <span className="pl-place-name">{label}</span>
      </span>
    </button>
  );
}
