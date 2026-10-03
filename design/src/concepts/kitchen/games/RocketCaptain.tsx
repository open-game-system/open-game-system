// Rocket Crew's own grown-up page (stand-in): the Captain reads to the crew and steers.
import { Star } from "./art";

export function RocketCaptain() {
  return (
    <div className="g-rc">
      <div className="g-rc-head">
        <div>
          <p className="g-rc-mission">Mission 6</p>
          <p className="g-rc-sub">Navigator rank · Chilly Island ahead</p>
        </div>
        <div className="g-rc-stars">
          <Star filled size={30} />
          <Star filled size={30} />
          <Star filled={false} size={30} />
        </div>
      </div>
      <div className="g-rc-read">
        <span>Read to your crew</span>
        <p>“The yellow light is blinking! Fixers, find the yellow star.”</p>
      </div>
      <div className="g-rc-pad">
        <button className="g-rc-steer" aria-label="Steer left" data-bot="rc-left">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M25 8 13 20l12 12" fill="none" stroke="#fff6e0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="g-rc-boost" data-bot="rc-boost">
          <span>Boost</span>
        </button>
        <button className="g-rc-steer" aria-label="Steer right" data-bot="rc-right">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M15 8l12 12-12 12" fill="none" stroke="#fff6e0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
