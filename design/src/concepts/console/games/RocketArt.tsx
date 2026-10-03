// Stand-in art for Rocket Crew's own controller views (the game ships these; OGS only frames them).
// Glossy toy rocket, violet nebula, bubblegum pink + gold. No faces on objects.

export function Rocket({ size = 120, tilt = 0, fault = false }: { size?: number; tilt?: number; fault?: boolean }) {
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 100 140" style={{ transform: `rotate(${tilt}deg)` }} aria-hidden>
      <defs>
        <linearGradient id="rk-body" x1="0" x2="1">
          <stop offset="0" stopColor="#d9d3ef" />
          <stop offset=".45" stopColor="#ffffff" />
          <stop offset="1" stopColor="#b9b0dc" />
        </linearGradient>
        <radialGradient id="rk-flame" cx=".5" cy="0" r="1">
          <stop offset="0" stopColor="#fff6e0" />
          <stop offset=".5" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#ff5fa2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="128" rx="13" ry="14" fill="url(#rk-flame)" />
      <path d="M22 92 L8 120 L30 110 Z" fill="#ff5fa2" />
      <path d="M78 92 L92 120 L70 110 Z" fill="#ff5fa2" />
      <path d="M50 6 C72 22 78 60 74 108 L26 108 C22 60 28 22 50 6 Z" fill="url(#rk-body)" />
      <path d="M38 18 C44 12 56 12 62 18 C58 10 54 7 50 6 C46 7 42 10 38 18Z" fill="#ff5fa2" />
      <rect x="26" y="70" width="48" height="7" fill="#ff5fa2" />
      <circle cx="50" cy="48" r="10" fill="#6fd3e8" stroke="#ff5fa2" strokeWidth="4" />
      <rect x="34" y="106" width="32" height="8" rx="3" fill="#8a84a8" />
      {fault && <circle cx="30" cy="96" r="7" fill="#ffd23f" className="cx-blink" />}
    </svg>
  );
}

/** Mission progress dots, matching the TV HUD (white, red, gold, then the ones still to visit). */
export function RouteDots({ done = 3, total = 10, size = 18 }: { done?: number; total?: number; size?: number }) {
  const colors = ["#fff6e0", "#f0533f", "#ffd23f"];
  return (
    <div style={{ display: "flex", gap: size * 0.55, alignItems: "center" }} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: i < done ? colors[i % colors.length] : "rgba(255,246,224,.16)",
            boxShadow: i < done ? `0 0 ${size * 0.6}px ${colors[i % colors.length]}` : "inset 0 0 0 2px rgba(255,246,224,.25)",
          }}
        />
      ))}
    </div>
  );
}

export function Star({ size = 28, on = true }: { size?: number; on?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill={on ? "#ffd23f" : "rgba(255,246,224,.18)"} stroke={on ? "#f0a400" : "rgba(255,246,224,.3)"} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Fixer's power cells: colour + shape, never colour alone. */
export const CELLS = [
  { id: "bolt", color: "#ff5fa2", path: "M13 2L5 14h6l-1 8 8-12h-6z" },
  { id: "star", color: "#ffd23f", path: "M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" },
  { id: "drop", color: "#6fd3e8", path: "M12 2.5C8 8 5.5 11.5 5.5 15a6.5 6.5 0 0013 0c0-3.5-2.5-7-6.5-12.5z" },
];
