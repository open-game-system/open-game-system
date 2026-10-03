// The iPad following the TV, as one continuous toy moment told with art and motion only.
// The old game is a card top-left, the next one a card top-right, and a dotted path swoops between
// them through the bottom of the screen. The child's own character walks that path:
//   paused    (grown-up opened the console menu) — the old game pauses, the character steps out
//             and waits on the path; the next card is an empty glowing window;
//   saving    — the old card gets a gold check, the next game appears in its window;
//   cutover   — the character hops along the bottom of the path toward the new game;
//   following — the new game's window opens wide around the character.
// Taps anywhere only sparkle; poking the character makes it hop. Nothing can derail the switch.
import { useRef } from "react";
import { gameById, type Person } from "../../../world";
import { GameArt } from "../ui/GameArt";
import { KidChar } from "./KidChar";
import { Bursts, useBursts } from "./juice";

export type TravelPhase = "paused" | "saving" | "cutover" | "following";

export const TRAVEL_PATH = "M240 280 C 300 760, 880 760, 940 280";

export function KidTravel({ from, to, phase, who }: { from: string; to: string | null; phase: TravelPhase; who: Person }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const a = gameById(from);
  const b = to ? gameById(to) : null;
  const ground = b ? b.palette.ground : a.palette.ground;
  const sparkle = [b ? b.palette.accent2 : "#fff6e0", "#fff6e0", who.color];
  return (
    <div
      ref={host}
      className={`kd-travel kd-travel--${phase}`}
      style={{ color: who.color, background: ground }}
      onPointerDown={(e) => fire(e, host.current, "spark", sparkle)}
    >
      <div className="kd-travel__bg" aria-hidden>
        <GameArt gameId={from} alt />
      </div>
      <div className="kd-travel__tint" style={{ background: `radial-gradient(90% 70% at 50% 100%, ${who.color}55, transparent 65%), linear-gradient(180deg, ${a.palette.ground}cc, ${ground}ee)` }} aria-hidden />

      <svg className="kd-travel__path" viewBox="0 0 1180 820" aria-hidden>
        <path d={TRAVEL_PATH} className="kd-path kd-path--ghost" />
        <path d={TRAVEL_PATH} className="kd-path kd-path--march" />
      </svg>

      <div className="kd-travel__from" aria-hidden>
        <GameArt gameId={from} alt />
        <span className="kd-travel__pause">
          <svg width="60" height="60" viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /></svg>
        </span>
        <span className="kd-travel__check">
          <svg width="64" height="64" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3a2a00" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>

      <div className={`kd-travel__to ${b ? "" : "is-empty"}`} aria-hidden>
        {b && <GameArt gameId={b.id} />}
        {!b && (
          <span className="kd-travel__twinkles">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} style={{ left: `${18 + i * 16}%`, top: `${30 + ((i * 37) % 40)}%`, animationDelay: `${i * 0.3}s` }} />
            ))}
          </span>
        )}
      </div>

      <div className="kd-travel__walker" style={{ offsetPath: `path("${TRAVEL_PATH}")` }}>
        <KidChar who={who} size={phase === "following" ? 240 : 300} onPoke={(e) => { e.stopPropagation(); fire(e, host.current, "star", sparkle, true); }} />
      </div>
      <Bursts bursts={bursts} />
    </div>
  );
}
