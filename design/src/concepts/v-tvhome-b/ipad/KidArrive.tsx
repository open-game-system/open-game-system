// A late iPad (woke after the switch) drops straight into its seat with a party: a burst of
// confetti in the child's colour and gold rings where the character lands, bottom centre.
// It sits over the game and never takes a touch; the confetti settles along the bottom edge.
import type { Person } from "../../../world";

const BITS = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  rest: 88 + ((i * 13) % 10),
  r: (i * 71) % 180,
  d: (i % 9) * 0.06,
  c: i % 3,
}));

export function KidArrive({ who }: { who: Person }) {
  const colors = [who.color, "#ffd23f", "#fff6e0"];
  return (
    <div className="kd-arrive" aria-hidden>
      <i className="kd-arrive__ring kd-arrive__ring--a" style={{ borderColor: who.color }} />
      <i className="kd-arrive__ring kd-arrive__ring--b" />
      <span className="kd-arrive__halo" style={{ background: `radial-gradient(closest-side, ${who.color}66, transparent)` }} />
      {BITS.map((b, i) => (
        <i
          key={i}
          className="kd-arrive__bit"
          style={{ left: `${b.x}%`, background: colors[b.c], animationDelay: `${b.d}s`, "--rest": `${b.rest}%`, "--rot": `${b.r}deg` }}
        />
      ))}
    </div>
  );
}
