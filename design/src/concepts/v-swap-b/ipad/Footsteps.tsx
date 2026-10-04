// Footsteps along the follow path, lighting up in the child's colour right behind the character
// as it walks. Each step lights exactly when the walker passes it (same distance, same clock), so
// the trail is the visible record of the trip: behind = lit, ahead = the white marching dots.
import { LEG, along, type LegPhase } from "./path";

const STEP = 3.4;
const STEPS = Array.from({ length: Math.floor(100 / STEP) }, (_, i) => {
  const d = (i + 1) * STEP;
  const p = along(d);
  const side = i % 2 === 0 ? 1 : -1;
  return { d, x: p.x + p.nx * 11 * side, y: p.y + p.ny * 11 * side };
});

export function Footsteps({ phase, color }: { phase: LegPhase; color: string }) {
  const leg = LEG[phase];
  return (
    <svg className="kd-steps" viewBox="0 0 1180 820" aria-hidden>
      {STEPS.map((s) => {
        const behind = s.d <= leg.from;
        const passing = !behind && s.d <= leg.to && leg.ms > 0;
        const delay = passing ? ((s.d - leg.from) / (leg.to - leg.from)) * leg.ms : 0;
        return (
          <circle
            key={`${phase}-${s.d}`}
            cx={s.x}
            cy={s.y}
            r={12}
            fill={color}
            className={`kd-step ${behind ? "is-lit" : passing ? "is-lighting" : ""}`}
            style={passing ? { animationDelay: `${Math.round(delay)}ms` } : undefined}
          />
        );
      })}
    </svg>
  );
}
