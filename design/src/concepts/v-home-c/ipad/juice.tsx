// Toy feedback shared by every kid screen: a burst of shapes where a finger lands, and a counter
// that restarts a squash/hop animation. (CSS custom properties in `style` are typed by the global
// React.CSSProperties augmentation the harness build already carries.)
// Local UI state only: nothing here can change the session.
import { useCallback, useRef, useState, type PointerEvent } from "react";

export type BurstKind = "spark" | "star" | "sprinkle" | "heart" | "puff";

export interface Burst {
  id: number;
  x: number;
  y: number;
  kind: BurstKind;
  colors: string[];
  big: boolean;
}

const PIECES = 12;

/** Bursts in the coordinate space of the element the handler sits on (stage scaling included). */
export function useBursts() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seq = useRef(0);
  const fireAt = useCallback((x: number, y: number, kind: BurstKind, colors: string[], big = false) => {
    seq.current += 1;
    const id = seq.current;
    setBursts((b) => [...b.slice(-14), { id, x, y, kind, colors, big }]);
    window.setTimeout(() => setBursts((b) => b.filter((x2) => x2.id !== id)), 1100);
  }, []);
  /** Fire at the pointer, relative to `host` (the positioned element that renders <Bursts>). */
  const fire = useCallback(
    (e: PointerEvent<Element>, host: HTMLElement | null, kind: BurstKind, colors: string[], big = false) => {
      if (!host) return;
      const r = host.getBoundingClientRect();
      const scale = host.offsetWidth ? r.width / host.offsetWidth : 1;
      fireAt((e.clientX - r.left) / scale, (e.clientY - r.top) / scale, kind, colors, big);
    },
    [fireAt],
  );
  return { bursts, fire, fireAt };
}

export function Bursts({ bursts }: { bursts: Burst[] }) {
  return (
    <div className="kd-bursts" aria-hidden>
      {bursts.map((b) => (
        <span key={b.id} className={`kd-burst kd-burst--${b.kind} ${b.big ? "is-big" : ""}`} style={{ left: b.x, top: b.y }}>
          <i className="kd-burst__ring" style={{ borderColor: b.colors[0] }} />
          {Array.from({ length: b.big ? PIECES + 6 : PIECES }, (_, i) => {
            const n = b.big ? PIECES + 6 : PIECES;
            const a = (i / n) * Math.PI * 2 + (b.id % 7) * 0.3;
            const d = (b.big ? 260 : 150) * (0.7 + ((i * 37) % 10) / 22);
            return (
              <i
                key={i}
                className="kd-burst__p"
                style={{
                  background: b.colors[i % b.colors.length],
                  "--dx": `${Math.cos(a) * d}px`,
                  "--dy": `${Math.sin(a) * d}px`,
                  "--r": `${(i * 67) % 360}deg`,
                }}
              />
            );
          })}
        </span>
      ))}
    </div>
  );
}
