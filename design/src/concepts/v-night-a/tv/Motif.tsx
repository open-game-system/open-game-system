// The console's signature, shared with the phone and the kid iPads: the ring mark (the room around
// tonight) and the dotted "follow" path (what moves from one screen to the next).
import { Mark } from "../ui/Brand";

/** The ring mark with a slow halo: the console is listening (menu open, switch under way). */
export function PulseMark({ size = 56 }: { size?: number }) {
  return (
    <span className="ct-pulse" style={{ width: size, height: size }}>
      <i />
      <i />
      <Mark size={size} />
    </span>
  );
}

/** A dotted follow path (same dash rhythm as the iPad's hop arc), drawn left to right. */
export function FollowPath({ d, w, h, className }: { d: string; w: number; h: number; className?: string }) {
  return (
    <svg className={`ct-follow ${className ?? ""}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray="1 22" />
    </svg>
  );
}

export function Clock() {
  return (
    <span className="ct-clock">
      <b>7:10</b>
      <span>Friday 3 October</span>
    </span>
  );
}
