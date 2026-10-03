// Rocket Crew's own controller views (stand-ins for the game's web content inside OGS).
import { CELLS, Rocket, RouteDots, Star } from "./RocketArt";
import { Portrait } from "../ui/Brand";
import type { Person } from "../../../world";

export function RocketCaptain({ juneau }: { juneau: Person }) {
  return (
    <div className="g-rocket g-rocket--phone">
      <div className="g-rocket__head">
        <div className="g-rocket__eyebrow">Mission 6 · Navigator</div>
        <div className="g-rocket__title">To Chilly Island</div>
        <div className="g-rocket__stars">
          <Star on />
          <Star on />
          <Star on={false} />
        </div>
      </div>
      <div className="g-rocket__route">
        <RouteDots done={3} total={10} size={16} />
      </div>
      <div className="g-rocket__call">
        <Portrait person={juneau} size={44} />
        <div>
          <b>Juneau's fixing the left engine.</b>
          <span>Say “three, two, one” when the gold light stops blinking.</span>
        </div>
      </div>
      <div className="g-rocket__pad">
        <button className="g-rocket__steer" aria-label="Steer left">
          <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="g-rocket__boost"><span>Boost</span></button>
        <button className="g-rocket__steer" aria-label="Steer right">
          <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}

/** Kid view: no words. The rocket shows which cell needs a tap; three giant cells, colour + shape. */
export function RocketFixer({ who }: { who: Person }) {
  return (
    <div className="g-rocket g-rocket--kid">
      <div className="g-rocket__nebula" />
      <div className="g-rocket__kidtop">
        <RouteDots done={3} total={10} size={30} />
      </div>
      <div className="g-rocket__ship">
        <Rocket size={300} fault />
      </div>
      <div className="g-rocket__cells">
        {CELLS.map((c, i) => (
          <button key={c.id} className={`g-rocket__cell ${i === 1 ? "is-hot" : ""}`} style={{ background: c.color }} aria-label={c.id}>
            <svg width="120" height="120" viewBox="0 0 24 24" aria-hidden>
              <path d={c.path} fill="#1b0f3a" fillOpacity=".82" />
            </svg>
          </button>
        ))}
      </div>
      <div className="g-kid-seat">
        <Portrait person={who} size={86} />
      </div>
    </div>
  );
}
