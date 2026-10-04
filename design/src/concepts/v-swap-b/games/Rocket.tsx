// Rocket Crew's own controller views (stand-ins for the game's web content inside OGS).
import { RouteDots, Star } from "./RocketArt";
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
