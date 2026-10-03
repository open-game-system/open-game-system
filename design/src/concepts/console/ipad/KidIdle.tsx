// Paired and waiting: "this iPad is mine, and it's listening to the TV". A toy, not a menu.
// His own character stands at the bottom centre; a dotted path runs from it up to the TV, and
// little lights keep travelling along it. Two big thumb toys (a star, a bubble) and the character
// itself all burst and send a comet up the path. No words, nothing to open, no way out.
import { useRef, useState, type PointerEvent } from "react";
import type { Person } from "../../../world";
import { KidChar } from "./KidChar";
import { Bursts, useBursts } from "./juice";

const PATH = "M700 430 C 760 300, 800 200, 890 175";
const SKY = Array.from({ length: 28 }, (_, i) => ({ x: (i * 41 + 7) % 100, y: (i * 67 + 3) % 62, d: (i % 7) * 0.4, s: 4 + (i % 3) * 3 }));

export function KidIdle({ who }: { who: Person }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const [comets, setComets] = useState<number[]>([]);
  const [tvPing, setTvPing] = useState(0);
  const [toys, setToys] = useState({ star: 0, bubble: 0 });

  const send = () => {
    const id = performance.now();
    setComets((c) => [...c.slice(-5), id]);
    window.setTimeout(() => setTvPing((n) => n + 1), 800);
    window.setTimeout(() => setComets((c) => c.filter((x) => x !== id)), 1000);
  };
  const toy = (name: "star" | "bubble", colors: string[]) => (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setToys((t) => ({ ...t, [name]: t[name] + 1 }));
    fire(e, host.current, name === "star" ? "star" : "spark", colors, true);
    send();
  };

  return (
    <div
      ref={host}
      className="kd-idle"
      style={{ color: who.color }}
      onPointerDown={(e) => fire(e, host.current, "spark", ["#fff6e0", who.color])}
    >
      <div className="kd-idle__sky" aria-hidden>
        {SKY.map((s, i) => (
          <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }} />
        ))}
      </div>
      <div className="kd-idle__hill" aria-hidden />

      <svg className="kd-idle__path" viewBox="0 0 1180 820" aria-hidden>
        <path d={PATH} className="kd-path kd-path--ghost" />
        <path d={PATH} className="kd-path kd-path--march" />
      </svg>
      {comets.map((id) => (
        <i key={id} className="kd-comet" style={{ offsetPath: `path("${PATH}")`, background: who.color }} aria-hidden />
      ))}

      <div key={tvPing} className={`kd-idle__tv ${tvPing ? "is-ping" : ""}`} aria-hidden>
        <svg width="250" height="190" viewBox="0 0 250 190">
          <rect x="8" y="8" width="234" height="144" rx="20" fill="#1d2030" stroke="#f4f2ee" strokeOpacity=".9" strokeWidth="8" />
          <rect x="26" y="26" width="198" height="108" rx="9" className="kd-idle__screen" />
          <path d="M125 58a22 22 0 1 1-19 11" fill="none" stroke="#fff6e0" strokeWidth="6" strokeLinecap="round" opacity=".85" />
          <circle cx="125" cy="80" r="8" fill="#fff6e0" opacity=".85" />
          <path d="M95 178h60" stroke="#f4f2ee" strokeOpacity=".9" strokeWidth="8" strokeLinecap="round" />
        </svg>
        <span className="kd-idle__glow" />
      </div>

      <button className="kd-toy kd-toy--left" aria-label="star" data-bot="kid-toy-star" onPointerDown={toy("star", ["#ffd23f", "#fff6e0", "#ff9f1c"])}>
        <svg key={toys.star} className={toys.star ? "is-squash" : ""} width="190" height="190" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 1.8l3.1 6.4 7 .9-5.2 4.8 1.4 6.9L12 17.3l-6.3 3.5 1.4-6.9L1.9 9.1l7-.9z" fill="#ffd23f" stroke="#fff3b8" strokeWidth=".8" strokeLinejoin="round" />
          <path d="M8.2 8.6c1-.3 2-.4 2.6-.2" stroke="#fffbe6" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </svg>
      </button>
      <button className="kd-toy kd-toy--right" aria-label="bubble" data-bot="kid-toy-bubble" onPointerDown={toy("bubble", ["#7fe3f5", "#fff6e0", "#c9a2ff"])}>
        <svg key={toys.bubble} className={toys.bubble ? "is-squash" : ""} width="190" height="190" viewBox="0 0 100 100" aria-hidden>
          <defs>
            <radialGradient id="kd-bub" cx=".35" cy=".3" r=".8">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
              <stop offset=".35" stopColor="#bdf3ff" stopOpacity=".55" />
              <stop offset="1" stopColor="#7c6cf0" stopOpacity=".7" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="url(#kd-bub)" stroke="#e6fbff" strokeWidth="3" />
          <path d="M28 34c4-7 10-11 17-12" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      <KidChar who={who} size={400} className="kd-idle__me" onPoke={(e) => { e.stopPropagation(); fire(e, host.current, "heart", [who.color, "#fff6e0", "#ff8fb1"], true); send(); }} />
      <Bursts bursts={bursts} />
    </div>
  );
}
