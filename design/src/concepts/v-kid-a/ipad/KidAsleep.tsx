// A paired iPad that's asleep with a flat battery. If someone taps it awake it shows only this:
// her own dinosaur curled up asleep in her toy box under a striped blanket, the room dark, an
// empty battery and a plug sliding toward it. Poking her
// makes her stir and puff a few sleepy bubbles. No words, nothing to press wrong; the moment it's
// charged enough it drops straight into her seat (see KidArrive).
import { useRef } from "react";
import type { Person } from "../../../world";
import { Room } from "./box/Room";
import { ToyBox, type BoxGeom } from "./box/ToyBox";
import { KidChar } from "./KidChar";

const BOX: BoxGeom = { x: 330, y: 610, w: 520, h: 240 };
import { Bursts, useBursts } from "./juice";

export function KidAsleep({ who, battery }: { who: Person; battery: number }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  return (
    <div ref={host} className="kd-asleep tb-asleep" style={{ color: who.color }} onPointerDown={(e) => fire(e, host.current, "puff", ["#cdb8ff88", "#ffffff66"])}>
      <Room dim />
      <div className="kd-asleep__moon" aria-hidden />
      <div className="kd-asleep__bubbles" aria-hidden>
        {[0, 1, 2].map((i) => (
          <i key={i} style={{ animationDelay: `${i * 0.9}s`, width: 26 + i * 18, height: 26 + i * 18 }} />
        ))}
      </div>
      <ToyBox part="back" g={BOX} color={who.color} open lidFace={<img src={who.sticker} alt="" draggable={false} />} />
      <KidChar who={who} size={480} sleeping className="tb-asleep__me" onPoke={(e) => { e.stopPropagation(); fire(e, host.current, "puff", ["#e9ddff", "#ffffff"], true); }} />
      <span className="tb-blanket" aria-hidden />
      <ToyBox part="front" g={BOX} color={who.color} open label={<span className="tb-disc"><img src={who.sticker} alt="" draggable={false} /></span>} />
      <div className="kd-asleep__charge" aria-hidden>
        <svg className="kd-asleep__plug" width="150" height="110" viewBox="0 0 150 110">
          <path d="M0 55h52" stroke="#f4f2ee" strokeOpacity=".75" strokeWidth="10" strokeLinecap="round" />
          <rect x="48" y="25" width="62" height="60" rx="16" fill="#f4f2ee" />
          <path d="M110 40h32M110 70h32" stroke="#f4f2ee" strokeWidth="10" strokeLinecap="round" />
        </svg>
        <svg width="250" height="130" viewBox="0 0 250 130">
          <rect x="8" y="10" width="210" height="110" rx="28" fill="#141018" stroke="#f4f2ee" strokeOpacity=".75" strokeWidth="10" />
          <rect x="224" y="45" width="18" height="40" rx="8" fill="#f4f2ee" fillOpacity=".75" />
          <rect x="26" y="28" width={Math.max(26, 174 * battery)} height="74" rx="14" fill="#e5484d" className="kd-asleep__cell" />
        </svg>
      </div>
      <Bursts bursts={bursts} />
    </div>
  );
}
