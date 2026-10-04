// "Buddy": on a kid iPad the child's own character IS the interface. It fills the screen, close
// up, and reacts to every touch (giggles, hops, wiggles, leans toward the finger). The only other
// thing on screen is a little window onto the TV in the corner the buddy faces; whenever something
// happens on the TV, the buddy turns to watch it.
//   idle      — exactly one giant thing to do: poke your buddy. It glances at the TV now and then.
//   paused    — the grown-up opened the console menu: the TV window grows, the paused game in it,
//               and the buddy turns to watch, curious, lit by the TV.
//   saving    — the old game gets its gold check and floats away; the buddy waves goodbye to it.
//   cutover   — the next game pours into the TV window and sparkles stream down to the buddy.
//   following — the next game lands in the buddy's hands, glowing, a beat before it opens wide.
// Every tap is pure delight; nothing here reads or writes the session. Zero words.
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { gameById, type Person } from "../../../world";
import { GameArt } from "../ui/GameArt";
import { Mark } from "../ui/Brand";
import { Bursts, useBursts, type BurstKind } from "./juice";
import { MASH_SPOTS, useMash } from "./mash";

export type Mood = "idle" | "paused" | "saving" | "cutover" | "following";

/**
 * Per-art staging (art metadata, like KidChar's PRESENCE): which way the painted character faces
 * (the TV window sits on that side so it can look at it), and how big it stands so every child's
 * buddy fills the screen equally.
 */
interface Staging {
  faces: "front" | "left" | "right";
  height: number;
  x: number;
  /** Top of the art, in iPad points (lower for art whose head sits where the TV window is). */
  top: number;
}
const STAGING: Record<string, Staging> = {
  "/art/story-nook/char-dragon.webp": { faces: "front", height: 960, x: 640, top: 34 },
  "/art/story-nook/char-dinosaur.webp": { faces: "right", height: 880, x: 430, top: 120 },
};
const DEFAULT_STAGING: Staging = { faces: "front", height: 940, x: 620, top: 34 };

export const staging = (who: Person): Staging => (who.portrait ? (STAGING[who.portrait] ?? DEFAULT_STAGING) : DEFAULT_STAGING);

const REACTIONS = ["giggle", "hop", "wiggle", "squish"] as const;
const REACTION_BURST: Record<(typeof REACTIONS)[number], BurstKind> = { giggle: "heart", hop: "star", wiggle: "spark", squish: "heart" };

export function Buddy({ who, mood, from, to, mashDemo = false }: { who: Person; mood: Mood; from?: string | null; to?: string | null; mashDemo?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const { giggle, tap } = useMash(mashDemo);
  const [pokes, setPokes] = useState(0);
  const [look, setLook] = useState(0);
  const stage = staging(who);
  const a = from ? gameById(from) : null;
  const b = to ? gameById(to) : null;
  // The room takes the next game's light once it's on its way; until then it's the child's colour.
  const glow = mood === "cutover" || mood === "following" ? (b?.palette.accent ?? who.color) : (a?.palette.accent ?? who.color);
  const room = mood === "following" && b ? b.palette.ground : (a?.palette.ground ?? "#1a1230");
  const reaction = REACTIONS[pokes % REACTIONS.length] ?? "giggle";
  const colors = [who.color, "#fff6e0", glow];

  const poke = (e: PointerEvent<HTMLButtonElement>) => {
    setPokes((p) => p + 1);
    tap();
    const box = host.current?.getBoundingClientRect();
    const w = host.current?.offsetWidth ?? 1180;
    if (box) {
      const x = ((e.clientX - box.left) / box.width) * w;
      setLook(Math.max(-1, Math.min(1, (x - stage.x) / 460)));
    }
    fire(e, host.current, REACTION_BURST[reaction], colors, true);
  };

  const style: CSSProperties = {
    "--me": who.color,
    "--glow": glow,
    "--room": room,
    "--bh": `${stage.height}px`,
    "--bx": `${stage.x}px`,
    "--bt": `${stage.top}px`,
    "--look": `${look * 7}deg`,
    "--look-x": `${look * 26}px`,
  };

  return (
    <div ref={host} className={`bd bd--${mood} bd--faces-${stage.faces} ${giggle ? "is-giggle" : ""}`} style={style}>
      <div className="bd__room" aria-hidden>
        <i className="bd__ring bd__ring--1" />
        <i className="bd__ring bd__ring--2" />
        <i className="bd__ring bd__ring--3" />
      </div>
      <div className="bd__beam" aria-hidden />

      <div className="bd__tv" aria-hidden>
        <span className="bd__screen">
          {a && <span className="bd__show bd__show--from"><GameArt gameId={a.id} /></span>}
          {b && <span className="bd__show bd__show--to"><GameArt gameId={b.id} /></span>}
          {!a && !b && (
            <span className="bd__show bd__show--home">
              <Mark size={70} color="#fff6e0" />
            </span>
          )}
          {mood === "paused" && (
            <span className="bd__pause">
              <svg width="64" height="64" viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /></svg>
            </span>
          )}
        </span>
        <span className="bd__stand" />
      </div>

      {mood === "saving" && a && (
        <div className="bd__bye" aria-hidden>
          <GameArt gameId={a.id} />
          <span className="bd__check">
            <svg width="60" height="60" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3a2a00" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      )}

      {mood === "cutover" && (
        <div className="bd__stream" aria-hidden>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <i key={i} style={{ animationDelay: `${i * 0.16}s`, background: i % 2 ? "#fff6e0" : glow }} />
          ))}
        </div>
      )}

      <div className="bd__posture">
        <div className="bd__look">
          <div className="bd__glance">
            <div key={pokes} className={`bd__react ${pokes ? `is-${reaction}` : ""}`}>
              {who.portrait && <img className="bd__art" src={who.portrait} alt="" draggable={false} />}
            </div>
          </div>
        </div>
      </div>

      {mood === "saving" && (
        <svg className="bd__wave" width="220" height="220" viewBox="0 0 220 220" aria-hidden>
          <path d="M60 40c-26 18-36 46-30 74" />
          <path d="M96 26c-38 24-54 64-46 106" />
          <path d="M134 14c-50 30-72 82-62 138" />
        </svg>
      )}

      {mood === "following" && b && (
        <div className="bd__held" aria-hidden>
          <span className="bd__held-glow" />
          <span className="bd__held-card"><GameArt gameId={b.id} /></span>
        </div>
      )}

      {mashDemo && (
        <div className="kd-mash" aria-hidden>
          {MASH_SPOTS.map((m, i) => (
            <span key={i} className="kd-mash__tap" style={{ left: m.x, top: m.y, animationDelay: `${m.d}s` }}>
              <i style={{ borderColor: colors[i % colors.length] }} />
              {[0, 1, 2, 3, 4].map((k) => (
                <b key={k} style={{ background: colors[(i + k) % colors.length], "--a": `${k * 72 + i * 23}deg` }} />
              ))}
            </span>
          ))}
        </div>
      )}
      <button className="bd__poke" aria-label={who.name} data-bot={`kid-buddy-${who.id}`} onPointerDown={poke} />
      <Bursts bursts={bursts} />
    </div>
  );
}
