// A paired iPad that's asleep with a flat battery: the screen is dark. If someone taps it awake,
// it shows only this: her sleepy dinosaur, an empty battery and a plug. No words, nothing to press
// wrong; the moment it's awake enough it drops into her seat.
import type { Person } from "../../../world";

export function KidAsleep({ who, battery }: { who: Person; battery: number }) {
  return (
    <div className="kid-asleep">
      <div className="kid-asleep__glow" style={{ background: `radial-gradient(closest-side, ${who.color}33, transparent)` }} />
      <img className="kid-asleep__me" src="/art/story-nook/char-dinosaur-sleep.webp" alt="" />
      <div className="kid-asleep__battery" aria-hidden>
        <svg width="300" height="150" viewBox="0 0 300 150">
          <rect x="10" y="20" width="250" height="110" rx="26" fill="none" stroke="#f4f2ee" strokeOpacity=".7" strokeWidth="10" />
          <rect x="268" y="55" width="18" height="40" rx="8" fill="#f4f2ee" fillOpacity=".7" />
          <rect x="28" y="38" width={Math.max(20, 214 * battery)} height="74" rx="12" fill="#e5484d" className="cx-blink" />
        </svg>
        <svg width="120" height="150" viewBox="0 0 24 30" className="kid-asleep__plug">
          <path d="M8 2v7M16 2v7" stroke="#f4f2ee" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M5 9h14v5a7 7 0 01-14 0z" fill="#f4f2ee" />
          <path d="M12 21v7" stroke="#f4f2ee" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
