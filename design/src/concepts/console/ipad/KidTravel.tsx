// The iPad following the TV, as one continuous toy moment told with art and motion only.
// The old game is a card top-left, the next one a card top-right, and a dotted path swoops between
// them through the bottom of the screen. The child's own character walks that path:
//   paused    (grown-up opened the console menu) — the old game pauses, the character steps out
//             and plays while it waits; the next window breathes with the games on the Up next shelf;
//   saving    — the old card gets a gold check, the next game lands in its window, and the
//             character sets off;
//   cutover   — the character walks the bottom of the path, footsteps lighting behind it;
//   following — the new game's window opens wide around the character as it arrives.
// The walk never stops between phases (path.ts LEG). Taps anywhere only sparkle; mashing makes the
// character giggle (mash.ts). Nothing here can change the session.
import { useRef } from "react";
import { gameById, type Person } from "../../../world";
import { GameArt } from "../ui/GameArt";
import { Footsteps } from "./Footsteps";
import { KidChar } from "./KidChar";
import { Bursts, useBursts } from "./juice";
import { MASH_SPOTS, useMash } from "./mash";
import { NextSlot } from "./NextSlot";
import { LEG, TRAVEL_PATH } from "./path";

export type TravelPhase = "paused" | "saving" | "cutover" | "following";

export function KidTravel({ from, to, phase, who, mashDemo = false }: { from: string; to: string | null; phase: TravelPhase; who: Person; mashDemo?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const a = gameById(from);
  const b = to ? gameById(to) : null;
  const ground = b ? b.palette.ground : a.palette.ground;
  const sparkle = [b ? b.palette.accent2 : "#fff6e0", "#fff6e0", who.color];
  const { giggle, tap } = useMash(mashDemo);
  const leg = LEG[phase];
  return (
    <div
      ref={host}
      className={`kd-travel kd-travel--${phase} ${giggle ? "is-giggle" : ""} ${mashDemo ? "kd-travel--mash" : ""}`}
      style={{ color: who.color, background: ground }}
      onPointerDown={(e) => {
        fire(e, host.current, "spark", sparkle);
        tap();
      }}
    >
      <div className="kd-travel__bg" aria-hidden>
        <GameArt gameId={from} alt />
      </div>
      <div className="kd-travel__tint" style={{ background: `radial-gradient(90% 70% at 50% 100%, ${who.color}55, transparent 65%), linear-gradient(180deg, ${a.palette.ground}cc, ${ground}ee)` }} aria-hidden />

      <svg className="kd-travel__path" viewBox="0 0 1180 820" aria-hidden>
        <path d={TRAVEL_PATH} className="kd-path kd-path--ghost" />
        <path d={TRAVEL_PATH} className="kd-path kd-path--march" />
      </svg>
      <Footsteps phase={phase} color={who.color} />
      {phase === "paused" && [0, 1, 2].map((i) => <i key={i} className="kd-travel__comet" style={{ offsetPath: `path("${TRAVEL_PATH}")`, animationDelay: `${i * 0.7}s` }} aria-hidden />)}

      <div className="kd-travel__from" aria-hidden>
        <GameArt gameId={from} alt />
        <span className="kd-travel__pause">
          <svg width="60" height="60" viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /></svg>
        </span>
        <span className="kd-travel__check">
          <svg width="64" height="64" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3a2a00" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>

      <div className={`kd-travel__to ${b ? "" : "is-choosing"}`} aria-hidden>
        {b ? <GameArt gameId={b.id} /> : <NextSlot from={from} />}
      </div>

      <div
        className="kd-travel__walker"
        style={{ offsetPath: `path("${TRAVEL_PATH}")`, "--from": `${leg.from}%`, "--to": `${leg.to}%`, animationName: `kd-leg-${phase}`, animationDuration: `${leg.ms}ms` }}
      >
        <KidChar
          who={who}
          size={phase === "following" ? 240 : 300}
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
