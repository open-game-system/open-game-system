// First run: nothing played yet. The library is already full (it's the directory); what's missing
// is the living room: a TV, the people, and the kids' iPads.
import { GAMES } from "../../../world";
import { Wordmark } from "../ui/Brand";
import { GameArt } from "../ui/GameArt";
import { People, TabletIcon, TvIcon } from "../ui/Icons";

export function FirstRun() {
  const couch = GAMES.filter((g) => g.shape === "couch");
  return (
    <div className="cx-scroll">
      <header className="cx-head">
        <Wordmark size={22} />
      </header>
      <div className="cx-hero">
        <div className="cx-hero__mosaic" aria-hidden>
          {couch.slice(0, 4).map((g) => (
            <GameArt key={g.id} gameId={g.id} />
          ))}
        </div>
        <h1 className="cx-hero__title">Every family game, one console.</h1>
        <p className="cx-hero__sub">Your TV is the screen. This phone is the remote. The kids' iPads follow along.</p>
      </div>
      <ol className="cx-setup">
        <li className="is-next">
          <span className="cx-setup__icon"><TvIcon size={22} /></span>
          <span className="cx-setup__text">
            <b>Living room TV is nearby</b>
            <span>Connect once. Games appear on it from then on.</span>
          </span>
          <button className="cx-btn cx-btn--primary cx-btn--sm" data-bot="connect-tv"><span>Connect</span></button>
        </li>
        <li>
          <span className="cx-setup__icon"><People size={22} /></span>
          <span className="cx-setup__text">
            <b>Who plays here</b>
            <span>Names and ages, so no game asks again.</span>
          </span>
        </li>
        <li>
          <span className="cx-setup__icon"><TabletIcon size={22} /></span>
          <span className="cx-setup__text">
            <b>The kids' iPads</b>
            <span>Pair each once. After that it just follows.</span>
          </span>
        </li>
      </ol>
      <section className="cx-sec">
        <h2 className="cx-h2">Already in your library</h2>
        <div className="cx-acts">
          {GAMES.map((g) => (
            <article key={g.id} className="cx-act cx-act--sm">
              <div className="cx-act__art">
                <GameArt gameId={g.id} alt />
              </div>
              <div className="cx-act__plate">
                <b>{g.name}</b>
                <span>{g.tagline}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
