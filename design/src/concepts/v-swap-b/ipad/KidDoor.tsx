// "Doorway" on a kid's iPad: the same door the TV shows, with this child's own character walking
// through it. Wordless, one continuous moment (keyed by the game being left, so it never cuts):
//   paused    — the old world dims; a closed arch of light stands in it, the next games drifting
//               behind its glass; the character waits on the doorstep;
//   saving    — a gold check stamps on the old world; the arch opens onto the next world;
//   cutover   — the arch grows; the character walks up the path and into the doorway;
//   following — the arch widens to the whole screen and the character comes out the other side,
//               back at the bottom centre, where it stands in every game.
// Taps anywhere only sparkle; mashing makes the character giggle. Nothing here changes the session.
import { useRef, type CSSProperties } from "react";
import { gameById, type Person } from "../../../world";
import { GameArt } from "../ui/GameArt";
import { KidChar } from "./KidChar";
import { Bursts, useBursts } from "./juice";
import { MASH_SPOTS, useMash } from "./mash";
import { NextSlot } from "./NextSlot";
import type { TravelPhase } from "./KidTravel";

/** iPad points (1180×820): the arch, and where the character stands (centre x, bottom, scale). */
const ARCH: Record<TravelPhase, { w: number; h: number; b: number }> = {
  paused: { w: 260, h: 370, b: 250 },
  saving: { w: 300, h: 420, b: 240 },
  cutover: { w: 420, h: 540, b: 190 },
  following: { w: 2000, h: 1900, b: -40 },
};
const WALK: Record<TravelPhase, { b: number; k: number }> = {
  paused: { b: 0, k: 1 },
  saving: { b: 0, k: 1 },
  cutover: { b: 196, k: 0.46 },
  following: { b: 0, k: 1 },
};

export function KidDoor({ from, to, phase, who, mashDemo = false }: { from: string; to: string | null; phase: TravelPhase; who: Person; mashDemo?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const b = to ? gameById(to) : null;
  const sparkle = [b ? b.palette.accent2 : "#fff6e0", "#fff6e0", who.color];
  const { giggle, tap } = useMash(mashDemo);
  const a = ARCH[phase];
  const w = WALK[phase];
  const door: CSSProperties = { width: a.w, height: a.h, bottom: a.b, marginLeft: -a.w / 2 };
  const walker: CSSProperties = { bottom: w.b, transform: `translateX(-50%) scale(${w.k})` };
  return (
    <div
      ref={host}
      className={`kdw kdw--${phase} ${giggle ? "is-giggle" : ""}`}
      style={{ color: who.color }}
      onPointerDown={(e) => {
        fire(e, host.current, "spark", sparkle);
        tap();
      }}
    >
      <div className="kdw__bg" aria-hidden>
        <GameArt gameId={from} alt />
      </div>
      <div className="kdw__from" aria-hidden>
        <GameArt gameId={from} alt />
      </div>
      <div className="kdw__spill" style={{ width: a.w * 2, marginLeft: -a.w }} aria-hidden />
      <div className="kdw__door" style={door} aria-hidden>
        {b ? (
          <div className="kdw__beyond" style={{ bottom: -a.b }}>
            <GameArt gameId={b.id} />
          </div>
        ) : (
          <NextSlot from={from} />
        )}
      </div>
      {phase !== "paused" && (
        <span className={`kdw__check ${phase === "following" ? "is-gone" : ""}`} aria-hidden>
          <svg width="64" height="64" viewBox="0 0 24 24">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3a2a00" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      <div className={`kdw__walker ${phase === "cutover" ? "is-walking" : ""}`} style={walker}>
        <KidChar
          who={who}
          size={300}
          onPoke={(e) => {
            e.stopPropagation();
            fire(e, host.current, "star", sparkle, true);
            tap();
          }}
        />
      </div>
      {mashDemo && (
        <div className="kd-mash" aria-hidden>
          {MASH_SPOTS.map((m, i) => (
            <span key={i} className="kd-mash__tap" style={{ left: m.x, top: m.y, animationDelay: `${m.d}s` }}>
              <i style={{ borderColor: sparkle[i % sparkle.length] }} />
              {[0, 1, 2, 3, 4].map((k) => (
                <b key={k} style={{ background: sparkle[(i + k) % sparkle.length], "--a": `${k * 72 + i * 23}deg` }} />
              ))}
            </span>
          ))}
        </div>
      )}
      <Bursts bursts={bursts} />
    </div>
  );
}
