// Variant "Instant + receipt", kid side. Two tiny moments, both wordless:
//   KidHeld — the grown-up opened the switch sheet: the game stays where it is, dimmed, with one big
//             pause disc; taps only sparkle. With `flash`, it's the 0.2 s save flash before the cut.
//   KidPop  — the child's character has just popped into the new game: two rings and a ring of
//             stars burst from where it lands (bottom centre), then clear away by themselves.
import { useRef } from "react";
import { gameById, type Person } from "../../../world";
import { GameKidView } from "../games/registry";
import { seatPlan } from "../state";
import { Bursts, useBursts } from "./juice";

export function KidHeld({ gameId, who, flash = false }: { gameId: string; who: Person; flash?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const seat = seatPlan(gameById(gameId)).find((x) => x.person.id === who.id);
  return (
    <div className={`kd-held ${flash ? "kd-held--flash" : ""}`} ref={host}>
      {seat && <GameKidView gameId={gameId} who={who} role={seat.role} />}
      <div className="kd-held__veil" aria-hidden onPointerDown={(e) => fire(e, host.current, "spark", [who.color, "#fff6e0", "#ffd23f"])}>
        {!flash && (
          <span className="kd-held__pause" style={{ boxShadow: `0 0 0 10px ${who.color}66, 0 20px 60px rgba(0,0,0,.45)` }}>
            <svg width="120" height="120" viewBox="0 0 24 24">
              <rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" />
              <rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" />
            </svg>
          </span>
        )}
      </div>
      <Bursts bursts={bursts} />
    </div>
  );
}

const STARS = Array.from({ length: 10 }, (_, i) => i * 36);

export function KidPop({ who }: { who: Person }) {
  return (
    <div className="kd-pop" aria-hidden>
      <i className="kd-pop__ring" style={{ borderColor: who.color }} />
      <i className="kd-pop__ring kd-pop__ring--b" />
      {STARS.map((a, i) => (
        <b key={a} className="kd-pop__star" style={{ "--a": `${a}deg`, background: i % 2 ? who.color : "#ffd23f" }} />
      ))}
    </div>
  );
}
