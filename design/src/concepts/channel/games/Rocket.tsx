// Stand-ins for Rocket Crew's own controller pages (the game owns these; OGS only frames them).
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import type { S } from "../state";
import { Arrow, Star } from "./icons";

const RC = gameById("rocket-crew");
const LIGHTS = [
  { id: "white", color: "#f4f1ff", shape: "circle" },
  { id: "red", color: "#ff4b4b", shape: "triangle" },
  { id: "yellow", color: "#ffd23f", shape: "star" },
] as const;

const bump = (store: Store<S>) => store.update((x) => ({ ...x, juice: x.juice + 1 }));

export function RocketCaptain({ store }: { store: Store<S> }) {
  return (
    <div className="ch-rc" style={{ backgroundImage: `url(${RC.art.alt})` }}>
      <div className="ch-rc-head">
        <span className="ch-rc-mission">Mission 6</span>
        <span className="ch-rc-dest">Chilly Island</span>
        <span className="ch-rc-stars">
          <Star size={28} />
          <Star size={28} />
          <Star size={28} dim />
        </span>
      </div>
      <div className="ch-rc-route" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < 3 ? "is-done" : ""} style={i < 3 ? { background: LIGHTS[i]?.color } : undefined} />
        ))}
      </div>
      <div className="ch-rc-order">
        <small>Captain's call · say it out loud</small>
        <p>
          "Fixer, the <b>yellow star</b> light is blinking. Tap it!"
        </p>
        <span className="ch-rc-swatch" aria-hidden="true">
          <Star size={44} />
        </span>
      </div>
      <div className="ch-rc-pad">
        <button className="ch-rc-btn" data-bot="rc-left" aria-label="Steer left" onClick={() => bump(store)}>
          <Arrow dir="left" />
        </button>
        <button className="ch-rc-btn ch-rc-boost" data-bot="rc-boost" onClick={() => bump(store)}>
          <span>Boost</span>
        </button>
        <button className="ch-rc-btn" data-bot="rc-right" aria-label="Steer right" onClick={() => bump(store)}>
          <Arrow dir="right" />
        </button>
      </div>
    </div>
  );
}

/** Juneau's Fixer panel: three lights, colour + shape, no words. Ava gets the one big star. */
export function RocketFixer({ store, little, juice }: { store: Store<S>; little: boolean; juice: number }) {
  return (
    <div className="ch-rc ch-rc-kid" style={{ backgroundImage: `url(${RC.art.tv})` }}>
      <div className="ch-rc-route ch-rc-route-kid" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < 3 ? "is-done" : ""} style={i < 3 ? { background: LIGHTS[i]?.color } : undefined} />
        ))}
      </div>
      {little ? (
        <button className="ch-rc-bigstar" data-bot="kid-tap" aria-label="" onClick={() => bump(store)} style={{ transform: `rotate(${(juice % 4) * 8 - 12}deg)` }}>
          <Star size={360} />
        </button>
      ) : (
        <div className="ch-rc-lights">
          {LIGHTS.map((l) => (
            <button key={l.id} className={`ch-rc-light${l.id === "yellow" ? " is-blink" : ""}`} data-bot={`kid-${l.id}`} onClick={() => bump(store)} style={{ background: l.color }}>
              <Shape shape={l.shape} />
            </button>
          ))}
        </div>
      )}
      <div className="ch-rc-lever" aria-hidden="true">
        <i style={{ height: `${30 + (juice % 5) * 14}%` }} />
      </div>
    </div>
  );
}

function Shape({ shape }: { shape: "circle" | "triangle" | "star" }) {
  if (shape === "star") return <Star size={130} fill="#fff6e0" />;
  return (
    <svg width="120" height="120" viewBox="0 0 24 24" aria-hidden="true">
      {shape === "circle" ? <circle cx="12" cy="12" r="8" fill="#1b0f3a" opacity=".7" /> : <path d="M12 4l9 16H3z" fill="#fff6e0" strokeLinejoin="round" stroke="#fff6e0" strokeWidth="1.5" />}
    </svg>
  );
}
