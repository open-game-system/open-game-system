// The channel's mark: the household's colour bars (one bar per person), a test card made of the family.
import { HOME } from "../../../world";

export function Bars({ height = 20, gap = 3, width = 6, live = false }: { height?: number; gap?: number; width?: number; live?: boolean }) {
  return (
    <span className={`ch-bars${live ? " is-live" : ""}`} style={{ gap, height }} aria-hidden="true">
      {HOME.people.map((p, i) => (
        <i key={p.id} style={{ background: p.color, width, animationDelay: `${i * 90}ms` }} />
      ))}
    </span>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="ch-wordmark" style={{ fontSize: size }}>
      <Bars height={size * 0.9} width={Math.max(4, size * 0.24)} gap={Math.max(2, size * 0.1)} />
      <span>
        Channel <b>Mumm</b>
      </span>
    </span>
  );
}

/** The red tally light: "this is on air right now". */
export function Tally({ label = "On now" }: { label?: string }) {
  return (
    <span className="ch-tally">
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
