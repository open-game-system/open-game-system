// Bake Shop's kid controllers (stand-ins for the game's own web content), in the game's soft-toy
// bakery look: butter cream walls, a wooden counter, strawberry pink and mint. Landscape, two thumbs.
// No words; every press squashes, bursts and changes the cupcake; nothing can be pressed wrong.
import { useRef, useState, type PointerEvent, type ReactNode, type RefObject } from "react";
import type { Person } from "../../../world";
import { KidChar } from "../ipad/KidChar";
import { Bursts, useBursts } from "../ipad/juice";
import { Cupcake, Oven, Shaker, Strawberry, Swirl } from "./BakeArt";

const SPRINKLES = ["#8fddbe", "#ffd23f", "#6fb7f0", "#f46a8e"];

function Bakery({ children, host, onDown, little = false }: { children: ReactNode; host: RefObject<HTMLDivElement | null>; onDown: (e: PointerEvent<HTMLDivElement>) => void; little?: boolean }) {
  return (
    <div ref={host} className={`gk-bake ${little ? "gk-bake--little" : ""}`} onPointerDown={onDown}>
      <div className="gk-bake__wall" aria-hidden>
        <span className="gk-bake__window" />
        <span className="gk-bake__shelf" />
      </div>
      <div className="gk-bake__counter" aria-hidden />
      {children}
    </div>
  );
}

type Step = "frosting" | "berry" | "sprinkles" | "oven";
const ORDER: Step[] = ["frosting", "berry", "sprinkles", "oven"];

function Bin({ step, hot, className, children, onPress }: { step: Step; hot: boolean; className: string; children: ReactNode; onPress: (e: PointerEvent<HTMLButtonElement>) => void }) {
  const [n, setN] = useState(0);
  return (
    <button
      className={`gk-bin ${className} ${hot ? "is-hot" : ""}`}
      aria-label={step}
      data-bot={`bin-${step}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        setN((x) => x + 1);
        onPress(e);
      }}
    >
      <span key={n} className={n ? "is-squash" : ""}>{children}</span>
    </button>
  );
}

/** Baker (Juneau): the bear's thought bubble shows the order; the next ingredient glows. */
export function BakeBaker({ who }: { who: Person }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire, fireAt } = useBursts();
  const [done, setDone] = useState(1);
  const [pop, setPop] = useState(0);
  const [cheer, setCheer] = useState(0);
  const press = (step: Step) => (e: PointerEvent<HTMLButtonElement>) => {
    const want = ORDER[done % ORDER.length];
    if (step !== want) {
      fire(e, host.current, "spark", ["#f9c6d3", "#fff8ea"]);
      return;
    }
    fire(e, host.current, step === "oven" ? "star" : "sprinkle", step === "berry" ? ["#e8384f", "#3fae6a", "#fff8ea"] : SPRINKLES, true);
    fireAt(590, 380, step === "oven" ? "star" : "sprinkle", step === "oven" ? ["#ffd23f", "#fff6e0", "#ffb347"] : SPRINKLES, step === "oven");
    setPop((p) => p + 1);
    setCheer((c) => c + 1);
    if (step === "oven") window.setTimeout(() => setDone(0), 1300);
    else setDone((d) => d + 1);
  };
  const want = ORDER[done % ORDER.length];
  const baked = done === 0 && pop > 0;
  return (
    <Bakery host={host} onDown={(e) => fire(e, host.current, "spark", SPRINKLES)}>
      <div className="gk-bake__guest" aria-hidden>
        <div className="gk-bake__dream">
          <Cupcake size={150} />
        </div>
        <img src="/art/bake-shop/char-bear.webp" alt="" />
      </div>
      <div key={pop} className={`gk-bake__plate ${pop ? "is-pop" : ""} ${baked ? "is-baked" : ""}`} aria-hidden>
        <Cupcake size={300} frosted={done >= 1} berry={done >= 2} sprinkles={done >= 3} />
      </div>
      <Bin step="frosting" hot={want === "frosting"} className="gk-bin--l1" onPress={press("frosting")}><Swirl size={150} /></Bin>
      <Bin step="berry" hot={want === "berry"} className="gk-bin--l2" onPress={press("berry")}><Strawberry size={140} /></Bin>
      <Bin step="sprinkles" hot={want === "sprinkles"} className="gk-bin--r1" onPress={press("sprinkles")}><Shaker size={150} /></Bin>
      <Bin step="oven" hot={want === "oven"} className="gk-bin--r2 gk-bin--oven" onPress={press("oven")}><Oven size={140} /></Bin>
      <KidChar who={who} size={250} cheer={cheer} className="gk-me" onPoke={(e) => { e.stopPropagation(); fire(e, host.current, "heart", [who.color, "#f46a8e", "#fff8ea"], true); }} />
      <Bursts bursts={bursts} />
    </Bakery>
  );
}

/** Littlest helper (Ava, almost 3): two giant toys, both always right. Sprinkles pile up on the cake. */
export function BakeHelper({ who }: { who: Person }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire, fireAt } = useBursts();
  const [shakes, setShakes] = useState(0);
  const [berries, setBerries] = useState(0);
  const [cheer, setCheer] = useState(0);
  const pile = Math.min(18 + shakes * 4, 60);
  return (
    <Bakery host={host} little onDown={(e) => fire(e, host.current, "sprinkle", SPRINKLES)}>
      <div key={`${shakes}-${berries}`} className={`gk-bake__cake ${shakes + berries ? "is-pop" : ""}`} aria-hidden>
        <svg width="340" height="260" viewBox="0 0 340 260">
          <ellipse cx="170" cy="232" rx="166" ry="24" fill="#fff" />
          <path d="M40 120h260v96a20 20 0 01-20 20H60a20 20 0 01-20-20z" fill="#f4b183" />
          <path d="M40 160h260" stroke="#e39466" strokeWidth="6" />
          <path d="M34 120c0-34 60-52 136-52s136 18 136 52c0 14-14 18-22 10-10 16-24 16-32 2-10 16-26 16-36 2-10 16-28 16-38 2-10 16-26 16-36 2-10 16-24 16-32 2-8 8-22 4-22-10z" fill="#fff4f6" />
          {Array.from({ length: pile }, (_, i) => (
            <rect key={i} x={60 + ((i * 53) % 220)} y={80 + ((i * 29) % 46)} width="14" height="5" rx="2.5" fill={SPRINKLES[i % 4]} transform={`rotate(${(i * 47) % 180} ${67 + ((i * 53) % 220)} ${82 + ((i * 29) % 46)})`} />
          ))}
          {Array.from({ length: Math.min(berries, 5) }, (_, i) => (
            <g key={i} transform={`translate(${78 + i * 44} ${52 + (i % 2) * 10}) scale(.5)`}>
              <path d="M40 10c16 0 26 10 22 24-3 14-13 25-22 30-9-5-19-16-22-30-4-14 6-24 22-24z" fill="#e8384f" />
              <path d="M24 10c6-8 26-8 32 0-6 5-26 5-32 0z" fill="#3fae6a" />
            </g>
          ))}
        </svg>
      </div>
      <button
        className="gk-giant gk-giant--left gk-giant--shaker"
        aria-label="sprinkles"
        data-bot="helper-shake"
        onPointerDown={(e) => {
          e.stopPropagation();
          setShakes((s) => s + 1);
          setCheer((c) => c + 1);
          fire(e, host.current, "sprinkle", SPRINKLES, true);
          fireAt(590, 330, "sprinkle", SPRINKLES, true);
        }}
      >
        <span key={shakes} className={shakes ? "is-shake" : ""}><Shaker size={280} /></span>
      </button>
      <button
        className="gk-giant gk-giant--right gk-giant--berry"
        aria-label="strawberry"
        data-bot="helper-berry"
        onPointerDown={(e) => {
          e.stopPropagation();
          setBerries((b) => b + 1);
          setCheer((c) => c + 1);
          fire(e, host.current, "heart", ["#e8384f", "#f46a8e", "#fff8ea"], true);
        }}
      >
        <span key={berries} className={berries ? "is-squash" : ""}><Strawberry size={260} /></span>
      </button>
      <KidChar who={who} size={250} cheer={cheer} className="gk-me" onPoke={(e) => { e.stopPropagation(); fire(e, host.current, "heart", [who.color, "#f46a8e", "#fff8ea"], true); }} />
      <Bursts bursts={bursts} />
    </Bakery>
  );
}
