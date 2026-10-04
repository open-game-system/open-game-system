// A paired iPad that's asleep with a flat battery. If someone taps it awake it shows only this:
// her buddy, huge and curled up asleep, filling the screen and breathing slowly, a few sleepy
// bubbles rising, and in the corner an empty battery with a plug sliding toward it. Poking her
// buddy makes it stir and puff a bubble. No words, nothing to press wrong; the moment it's charged
// enough it drops straight into her seat (see KidArrive).
import { useRef, useState } from "react";
import type { Person } from "../../../world";
import { Bursts, useBursts } from "./juice";

/** Sleeping art where the painter made one; anyone else's buddy sleeps as their usual sticker. */
const SLEEP_ART: Record<string, string> = { "/art/story-nook/char-dinosaur.webp": "/art/story-nook/char-dinosaur-sleep.webp" };

export function KidAsleep({ who, battery }: { who: Person; battery: number }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const [stir, setStir] = useState(0);
  const src = who.portrait ? (SLEEP_ART[who.portrait] ?? who.portrait) : undefined;
  return (
    <div ref={host} className="bd-sleep" style={{ "--me": who.color }}>
      <div className="bd-sleep__moon" aria-hidden />
      <div className="bd-sleep__bubbles" aria-hidden>
        {[0, 1, 2].map((i) => (
          <i key={i} style={{ animationDelay: `${i * 0.9}s`, width: 34 + i * 22, height: 34 + i * 22 }} />
        ))}
      </div>
      <div className="bd-sleep__body" aria-hidden>
        <div key={stir} className={stir ? "is-stir" : ""}>
          {src && <img className={src === who.portrait ? "is-dim" : ""} src={src} alt="" draggable={false} />}
        </div>
      </div>
      <div className="bd-sleep__charge" aria-hidden>
        <svg className="bd-sleep__plug" width="110" height="80" viewBox="0 0 150 110">
          <path d="M0 55h52" stroke="#f4f2ee" strokeOpacity=".75" strokeWidth="10" strokeLinecap="round" />
          <rect x="48" y="25" width="62" height="60" rx="16" fill="#f4f2ee" />
          <path d="M110 40h32M110 70h32" stroke="#f4f2ee" strokeWidth="10" strokeLinecap="round" />
        </svg>
        <svg width="180" height="94" viewBox="0 0 250 130">
          <rect x="8" y="10" width="210" height="110" rx="28" fill="#141018" stroke="#f4f2ee" strokeOpacity=".75" strokeWidth="10" />
          <rect x="224" y="45" width="18" height="40" rx="8" fill="#f4f2ee" fillOpacity=".75" />
          <rect x="26" y="28" width={Math.max(26, 174 * battery)} height="74" rx="14" fill="#e5484d" className="bd-sleep__cell" />
        </svg>
      </div>
      <button
        className="bd__poke"
        aria-label={who.name}
        data-bot={`kid-buddy-${who.id}`}
        onPointerDown={(e) => {
          setStir((n) => n + 1);
          fire(e, host.current, "puff", ["#e9ddff", "#ffffff"], true);
        }}
      />
      <Bursts bursts={bursts} />
    </div>
  );
}
