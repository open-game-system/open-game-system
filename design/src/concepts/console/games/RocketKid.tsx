// Rocket Crew's kid controllers (stand-ins for the game's own web content), in the game's
// bubblegum-space look: violet nebula, glossy white rocket, pink + gold. Landscape, two thumbs.
// No words; every press squashes, bursts and moves the rocket; nothing can be pressed wrong.
import { useRef, useState, type PointerEvent, type ReactNode, type RefObject } from "react";
import type { Person } from "../../../world";
import { KidChar } from "../ipad/KidChar";
import { Bursts, useBursts } from "../ipad/juice";
import { KID_CELLS, Planet, Rocket, RouteDots, type Cell } from "./RocketArt";

function Space({ children, host, onDown }: { children: ReactNode; host: RefObject<HTMLDivElement | null>; onDown: (e: PointerEvent<HTMLDivElement>) => void }) {
  return (
    <div ref={host} className="gk-rocket" onPointerDown={onDown}>
      <div className="gk-rocket__stars" aria-hidden />
      <div className="gk-rocket__planet" aria-hidden>
        <Planet size={300} />
      </div>
      {children}
    </div>
  );
}

function CellButton({ cell, hot, size, className, onPress }: { cell: Cell; hot: boolean; size: number; className: string; onPress: (e: PointerEvent<HTMLButtonElement>) => void }) {
  const [n, setN] = useState(0);
  return (
    <button
      className={`gk-cell ${className} ${hot ? "is-hot" : ""}`}
      style={{ width: size, height: size, background: `radial-gradient(circle at 38% 30%, #ffffffaa, transparent 42%), ${cell.color}`, color: cell.color }}
      aria-label={cell.id}
      data-bot={`cell-${cell.id}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        setN((x) => x + 1);
        onPress(e);
      }}
    >
      <svg key={n} className={n ? "is-squash" : ""} width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" aria-hidden>
        <path d={cell.path} fill="#1b0f3a" fillOpacity=".82" />
      </svg>
    </button>
  );
}

/** Fixer (Juneau): the rocket's engine light shows a shape; tap the cell with that shape. */
export function RocketFixer({ who }: { who: Person }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const [hot, setHot] = useState(1);
  const [boost, setBoost] = useState(0);
  const [wobble, setWobble] = useState(0);
  const [cheer, setCheer] = useState(0);
  const press = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    const cell = KID_CELLS[i];
    if (!cell) return;
    if (i === hot) {
      fire(e, host.current, "star", [cell.color, "#fff6e0", "#ffd23f"], true);
      setBoost((b) => b + 1);
      setCheer((c) => c + 1);
      window.setTimeout(() => setHot((h) => (h + 1 + (i % 2)) % KID_CELLS.length), 650);
    } else {
      fire(e, host.current, "spark", [cell.color, "#fff6e0"]);
      setWobble((w) => w + 1);
    }
  };
  const want = KID_CELLS[hot];
  const slots = ["gk-cell--l1", "gk-cell--l2", "gk-cell--r1", "gk-cell--r2"];
  return (
    <Space host={host} onDown={(e) => fire(e, host.current, "spark", ["#fff6e0", "#ff5fa2"])}>
      <div className="gk-rocket__route">
        <RouteDots done={3} total={10} size={20} />
      </div>
      <div key={`b${boost}-w${wobble}`} className={`gk-rocket__ship ${boost ? "is-boost" : ""} ${wobble ? "is-wobble" : ""}`} aria-hidden>
        <Rocket size={230} fault flame={boost > 0 ? 1.8 : 1} />
      </div>
      {want && (
        <div key={hot} className="gk-rocket__need" style={{ background: want.color }} aria-hidden>
          <svg width="96" height="96" viewBox="0 0 24 24"><path d={want.path} fill="#1b0f3a" fillOpacity=".85" /></svg>
        </div>
      )}
      {KID_CELLS.map((c, i) => (
        <CellButton key={c.id} cell={c} hot={i === hot} size={i % 2 === 0 ? 230 : 200} className={slots[i] ?? ""} onPress={press(i)} />
      ))}
      <KidChar who={who} size={250} cheer={cheer} className="gk-me" onPoke={(e) => { e.stopPropagation(); fire(e, host.current, "heart", [who.color, "#fff6e0"], true); }} />
      <Bursts bursts={bursts} />
    </Space>
  );
}

/** Littlest helper (Ava, almost 3): two giant buttons that are always right. */
export function RocketHelper({ who }: { who: Person }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const [boost, setBoost] = useState(0);
  const [twinkle, setTwinkle] = useState(0);
  const [cheer, setCheer] = useState(0);
  return (
    <Space host={host} onDown={(e) => fire(e, host.current, "spark", ["#fff6e0", "#ffd23f"])}>
      <div key={`b${boost}-t${twinkle}`} className={`gk-rocket__ship gk-rocket__ship--little ${boost ? "is-boost" : ""} ${twinkle ? "is-twinkle" : ""}`} aria-hidden>
        <Rocket size={230} flame={boost > 0 ? 2 : 1} />
      </div>
      <button
        className="gk-giant gk-giant--left gk-giant--star"
        aria-label="star"
        data-bot="helper-star"
        onPointerDown={(e) => {
          e.stopPropagation();
          setTwinkle((t) => t + 1);
          setCheer((c) => c + 1);
          fire(e, host.current, "star", ["#ffd23f", "#fff6e0", "#ff9f1c"], true);
        }}
      >
        <svg key={twinkle} className={twinkle ? "is-squash" : ""} width="260" height="260" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 1.8l3.1 6.4 7 .9-5.2 4.8 1.4 6.9L12 17.3l-6.3 3.5 1.4-6.9L1.9 9.1l7-.9z" fill="#ffd23f" stroke="#fff3b8" strokeWidth=".8" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        className="gk-giant gk-giant--right gk-giant--boost"
        aria-label="boost"
        data-bot="helper-boost"
        onPointerDown={(e) => {
          e.stopPropagation();
          setBoost((b) => b + 1);
          setCheer((c) => c + 1);
          fire(e, host.current, "spark", ["#ff5fa2", "#ffd23f", "#fff6e0"], true);
        }}
      >
        <svg key={boost} className={boost ? "is-squash" : ""} width="230" height="230" viewBox="0 0 100 100" aria-hidden>
          <path d="M50 8c14 18 26 32 26 52a26 26 0 01-52 0c0-20 12-34 26-52z" fill="#ffd23f" />
          <path d="M50 38c7 9 13 16 13 26a13 13 0 01-26 0c0-10 6-17 13-26z" fill="#fff6e0" />
        </svg>
      </button>
      <KidChar who={who} size={250} cheer={cheer} className="gk-me" onPoke={(e) => { e.stopPropagation(); fire(e, host.current, "heart", [who.color, "#fff6e0"], true); }} />
      <Bursts bursts={bursts} />
    </Space>
  );
}
