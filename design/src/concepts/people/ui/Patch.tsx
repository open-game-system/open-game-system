// A person is a "patch": their colour, a fabric pattern that's theirs alone, a stitched edge,
// and their painted portrait when a game made one. Households are quilts of patches.
import { useId } from "react";
import type { Person } from "../../../world";

const PATTERNS = ["dots", "stripes", "waves", "check", "chevron", "grid"] as const;
type Pattern = (typeof PATTERNS)[number];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const patternFor = (id: string): Pattern => PATTERNS[hash(id) % PATTERNS.length] ?? "dots";

function PatternTile({ kind, id }: { kind: Pattern; id: string }) {
  const ink = "rgba(255,255,255,0.32)";
  switch (kind) {
    case "dots":
      return (
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="2" fill={ink} />
        </pattern>
      );
    case "stripes":
      return (
        <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="3.5" height="9" fill={ink} />
        </pattern>
      );
    case "waves":
      return (
        <pattern id={id} width="16" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 4 Q4 0 8 4 T16 4" fill="none" stroke={ink} strokeWidth="2" />
        </pattern>
      );
    case "check":
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={ink} />
          <rect x="6" y="6" width="6" height="6" fill={ink} />
        </pattern>
      );
    case "chevron":
      return (
        <pattern id={id} width="12" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 7 L6 2 L12 7" fill="none" stroke={ink} strokeWidth="2" />
        </pattern>
      );
    case "grid":
      return (
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0 V10 M0 10 H10" fill="none" stroke={ink} strokeWidth="1.6" />
        </pattern>
      );
  }
}

export interface PatchProps {
  person: Pick<Person, "id" | "color" | "portrait">;
  size?: number;
  /** Not here tonight / not followed: the patch goes quiet. */
  dim?: boolean;
  /** Draw the portrait (kids' painted characters) when there is one. */
  portrait?: boolean;
  className?: string;
}

export function Patch({ person, size = 44, dim, portrait = true, className }: PatchProps) {
  const uid = useId().replace(/:/g, "");
  const pat = `p${uid}`;
  const clip = `c${uid}`;
  const img = portrait ? person.portrait : undefined;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      style={{ flex: "none", opacity: dim ? 0.38 : 1, filter: dim ? "grayscale(0.7)" : undefined }}
    >
      <defs>
        <PatternTile kind={patternFor(person.id)} id={pat} />
        <clipPath id={clip}>
          <path d="M24 1.5c12.6 0 22.5 9.4 22.5 22.5S36.6 46.5 24 46.5 1.5 37.1 1.5 24 11.4 1.5 24 1.5z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="48" height="48" fill={person.color} />
        <rect width="48" height="48" fill={`url(#${pat})`} />
        {img && <image href={img} x="2" y="4" width="44" height="44" preserveAspectRatio="xMidYMid slice" />}
      </g>
      <path
        d="M24 5c10.7 0 19 7.9 19 19s-8.3 19-19 19S5 35.1 5 24 13.3 5 24 5z"
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="1.3"
        strokeDasharray="2.6 2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A household or a group: patches stitched into a small quilt. */
export function Quilt({ people, size = 48 }: { people: Pick<Person, "id" | "color" | "portrait">[]; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const n = Math.min(people.length, 4);
  const cells = people.slice(0, 4);
  const cols = n <= 1 ? 1 : 2;
  const rows = n <= 2 ? 1 : 2;
  const cw = 48 / cols;
  const ch = 48 / rows;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <clipPath id={`q${uid}`}>
          <rect x="1" y="1" width="46" height="46" rx="14" />
        </clipPath>
        {cells.map((p, i) => (
          <PatternTile key={p.id} kind={patternFor(p.id)} id={`q${uid}p${i}`} />
        ))}
      </defs>
      <g clipPath={`url(#q${uid})`}>
        {cells.map((p, i) => {
          const w = n === 3 && i === 2 ? 48 : cw;
          const x = n === 3 && i === 2 ? 0 : (i % cols) * cw;
          const y = Math.floor(i / cols) * ch;
          return (
            <g key={p.id}>
              <rect x={x} y={y} width={w} height={ch} fill={p.color} />
              <rect x={x} y={y} width={w} height={ch} fill={`url(#q${uid}p${i})`} />
            </g>
          );
        })}
        {cols > 1 && <path d="M24 3V45" stroke="rgba(255,255,255,0.9)" strokeWidth="1.3" strokeDasharray="2.6 2.4" />}
        {rows > 1 && <path d="M3 24H45" stroke="rgba(255,255,255,0.9)" strokeWidth="1.3" strokeDasharray="2.6 2.4" />}
      </g>
      <rect x="4.5" y="4.5" width="39" height="39" rx="11" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3" strokeDasharray="2.6 2.4" />
    </svg>
  );
}
