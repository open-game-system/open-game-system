// First run, before anything: the library is already full (it's the directory). What's missing
// is the living room: a TV, the people (each picks a sticker), and the kids' iPads.
import type { Store } from "../../../../harness/store";
import { GAMES, HOME } from "../../../../world";
import { setupPatch, type S } from "../../state";
import { Wordmark } from "../../ui/Brand";
import { GameArt } from "../../ui/GameArt";
import { TabletIcon, TvIcon } from "../../ui/Icons";
import { Crest, Sticker } from "../../ui/Sticker";

export function Welcome({ store }: { store: Store<S> }) {
  const couch = GAMES.filter((g) => g.shape === "couch");
  return (
    <div className="fr">
      <div className="cx-scroll fr-scroll">
        <header className="cx-head">
          <Wordmark size={22} />
        </header>
        <div className="fr-hero">
          <div className="fr-hero__art" aria-hidden>
            {couch.slice(0, 3).map((g) => (
              <GameArt key={g.id} gameId={g.id} />
            ))}
          </div>
          <div className="fr-hero__cast" aria-hidden>
            {HOME.people.map((p) => (
              <Sticker key={p.id} person={p} size={54} />
            ))}
          </div>
        </div>
        <h1 className="cx-title">Every family game, one living room.</h1>
        <p className="cx-lede">The TV is the screen. This phone is the remote. The kids' iPads follow along by name.</p>
        <ol className="fr-stops">
          <li>
            <span className="fr-stops__icon"><TvIcon size={22} /></span>
            <span><b>Connect the living room TV</b><span>Once. Games cast to it from then on.</span></span>
          </li>
          <li>
            <span className="fr-stops__icon"><Crest household={HOME} size={38} /></span>
            <span><b>Who plays here</b><span>Names, ages and a sticker each. No game asks again.</span></span>
          </li>
          <li>
            <span className="fr-stops__icon"><TabletIcon size={22} /></span>
            <span><b>Pair the kids' iPads</b><span>Once per iPad. Then it just follows.</span></span>
          </li>
        </ol>
        <p className="fr-note">About two minutes. Nothing is installed on the TV.</p>
      </div>
      <div className="cx-dock fr-dock">
        <button className="cx-btn cx-btn--light cx-wide" data-bot="setup-start" onClick={() => store.update((x) => setupPatch(x, { step: "tv", tv: "searching" }))}>
          <span>Set up the living room</span>
        </button>
      </div>
    </div>
  );
}
