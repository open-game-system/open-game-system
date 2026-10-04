// Paired and waiting: the iPad is this child's own toy box. Their character pops out of a painted
// box (their sticker on the front, their colour on the paint) at the bottom centre, and everything
// they've collected across games lies around it on the rug: Rocket Crew's planet, a Bake Shop
// cupcake and plush bunny, Story Nook's paper stickers, a Peekaboo flower, a Night Flight moon.
// Poke a keepsake: it hops and bursts in its game's colours. Drag it: it goes where you put it.
// Bang the box: everything tumbles in and out again, somewhere new. No words, nothing to open, no
// way out; nothing here touches the session. It does not look like OGS; it looks like theirs.
import { useRef, useState, type PointerEvent } from "react";
import type { Person } from "../../../world";
import { KeepsakeArt } from "./box/KeepsakeArt";
import { keepsakesFor, SLOTS, slotOf, type Keepsake } from "./box/keepsakes";
import { Room } from "./box/Room";
import { ToyBox, type BoxGeom } from "./box/ToyBox";
import { KidChar } from "./KidChar";
import { Bursts, useBursts } from "./juice";

const BOX: BoxGeom = { x: 360, y: 600, w: 460, h: 240 };
const CHAR = 380;

export function KidIdle({ who }: { who: Person }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const [jumble, setJumble] = useState(0);
  const [bang, setBang] = useState(0);
  const [cheer, setCheer] = useState(0);
  const keeps = keepsakesFor(who);

  const shake = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setJumble((j) => j + 1);
    setBang((b) => b + 1);
    setCheer((c) => c + 1);
    fire(e, host.current, "star", [who.color, "#ffd23f", "#fff6e0"], true);
  };

  return (
    <div ref={host} className="tb-idle" style={{ color: who.color }} onPointerDown={(e) => fire(e, host.current, "spark", ["#fff6e0", who.color])}>
      <Room />
      {keeps.map((k, i) => (
        <KeepsakeToy key={k.id} k={k} i={i} jumble={jumble} onPoke={(e) => fire(e, host.current, k.kind === "img" ? "heart" : "star", k.colors, true)} />
      ))}
      <ToyBox part="back" g={BOX} color={who.color} open key={`b${bang}`} className={bang ? "is-bang" : ""} lidFace={who.sticker && <img src={who.sticker} alt="" draggable={false} />} />
      <KidChar
        who={who}
        size={CHAR}
        cheer={cheer}
        className="tb-idle__me"
        onPoke={(e) => {
          e.stopPropagation();
          fire(e, host.current, "heart", [who.color, "#fff6e0", "#ff8fb1"], true);
        }}
      />
      <ToyBox
        part="front"
        g={BOX}
        color={who.color}
        open
        key={`f${bang}`}
        className={bang ? "is-bang" : ""}
        bot="kid-toybox"
        onPointerDown={shake}
        label={<span className="tb-disc"><img src={who.sticker} alt="" draggable={false} /></span>}
      />
      <Bursts bursts={bursts} />
    </div>
  );
}

/** One keepsake on the floor: poke to hop, drag to move, flies to a new slot on every jumble. */
function KeepsakeToy({ k, i, jumble, onPoke }: { k: Keepsake; i: number; jumble: number; onPoke: (e: PointerEvent<HTMLButtonElement>) => void }) {
  const slot = SLOTS[slotOf(i, jumble)] ?? { x: 590, y: 400, r: 0 };
  const [drag, setDrag] = useState<{ x: number; y: number; at: number } | null>(null);
  const [hop, setHop] = useState({ n: 0, at: 0 });
  const start = useRef<{ px: number; py: number; x: number; y: number; scale: number } | null>(null);
  // A jumble sends it home to its new slot, dropping wherever it was dragged.
  const placed = drag && drag.at === jumble ? drag : null;
  const x = placed ? placed.x : slot.x;
  const y = placed ? placed.y : slot.y;
  return (
    <button
      className="tb-keep"
      style={{ left: x, top: y, "--r": `${slot.r}deg`, transitionDelay: placed ? "0ms" : `${(i % 6) * 45}ms` }}
      aria-label={k.gameId}
      data-bot={`keep-${k.id}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        const host = e.currentTarget.offsetParent;
        const r = host instanceof HTMLElement ? host.getBoundingClientRect() : null;
        const scale = r && host instanceof HTMLElement && host.offsetWidth ? r.width / host.offsetWidth : 1;
        start.current = { px: e.clientX, py: e.clientY, x, y, scale };
        e.currentTarget.setPointerCapture(e.pointerId);
        setHop((h) => ({ n: h.n + 1, at: jumble }));
        onPoke(e);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const dx = (e.clientX - s.px) / s.scale;
        const dy = (e.clientY - s.py) / s.scale;
        if (Math.hypot(dx, dy) < 6) return;
        setDrag({ x: Math.min(1120, Math.max(60, s.x + dx)), y: Math.min(780, Math.max(60, s.y + dy)), at: jumble });
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      <span key={`${hop.n}-${jumble}`} className={`tb-keep__body ${hop.n && hop.at === jumble ? "is-hop" : jumble ? "is-tumble" : ""}`}>
        <KeepsakeArt k={k} />
      </span>
    </button>
  );
}
