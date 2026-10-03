// Small drawn props for the games' stand-in controllers, in each game's own palette. No faces.

export function Star({ size = 40, filled, color = "#ffd23f" }: { size?: number; filled: boolean; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M20 3.5 25 14l11.4 1.5-8.3 7.9 2.1 11.3L20 29.3 9.8 34.7l2.1-11.3-8.3-7.9L15 14Z"
        fill={filled ? color : "none"}
        stroke={filled ? "#fff6e0" : "rgba(255,246,224,.55)"}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type Shape = "circle" | "triangle" | "star" | "square";
export function ShapeGlyph({ shape, size, color }: { shape: Shape; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {shape === "circle" && <circle cx="50" cy="50" r="30" fill={color} />}
      {shape === "triangle" && <path d="M50 16 86 80H14Z" fill={color} strokeLinejoin="round" />}
      {shape === "square" && <rect x="20" y="20" width="60" height="60" rx="10" fill={color} />}
      {shape === "star" && <path d="M50 10 61 37l29 3-22 19 7 29-25-15-25 15 7-29-22-19 29-3Z" fill={color} />}
    </svg>
  );
}

/** A cupcake: liner, optional frosting, optional sprinkles. */
export function Cupcake({ size = 200, frosting, sprinkles }: { size?: number; frosting?: string; sprinkles?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <ellipse cx="100" cy="186" rx="70" ry="9" fill="#6b3a22" opacity=".14" />
      <path d="M44 104h112l-14 76H58Z" fill="#e9b97a" stroke="#6b3a22" strokeWidth="5" strokeLinejoin="round" />
      <path d="M70 108l6 70M100 108v70M130 108l-6 70" stroke="#6b3a22" strokeWidth="4" opacity=".35" />
      <path d="M44 104c0-14 10-22 26-22h60c16 0 26 8 26 22Z" fill="#c98a4b" stroke="#6b3a22" strokeWidth="5" />
      {frosting && (
        <g className="kt-pop">
          <path
            d="M38 106c-6-22 14-34 30-30 0-22 22-34 40-26 10-18 40-16 46 6 18 2 26 26 12 40-30 10-96 12-128 10Z"
            fill={frosting}
            stroke="#6b3a22"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path d="M70 70c10-6 26-6 36 2" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".55" fill="none" />
          <circle cx="104" cy="34" r="12" fill="#d8243b" stroke="#6b3a22" strokeWidth="4" />
          <path d="M104 22c2-6 8-8 12-8" stroke="#3f8f4a" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      )}
      {sprinkles && (
        <g strokeWidth="5" strokeLinecap="round">
          <path d="M62 84l6-4" stroke="#8fddbe" />
          <path d="M88 64l6 3" stroke="#ffd23f" />
          <path d="M126 70l-5 5" stroke="#5fb8ff" />
          <path d="M146 92l6 2" stroke="#fff" />
          <path d="M110 88l-4 6" stroke="#8fddbe" />
          <path d="M76 98l7 1" stroke="#ffd23f" />
        </g>
      )}
    </svg>
  );
}

export function Swirl({ color, size = 120 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <path
        d="M18 92c-4-20 12-30 26-28-2-20 16-34 32-26 8-14 30-10 32 8 10 6 10 30-4 40-30 8-62 10-86 6Z"
        fill={color}
        stroke="#6b3a22"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M44 62c8-6 22-8 32 0" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".5" fill="none" />
    </svg>
  );
}

export function Shaker({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <rect x="34" y="40" width="52" height="66" rx="10" fill="#fff8ec" stroke="#6b3a22" strokeWidth="5" />
      <path d="M38 40c0-12 8-20 22-20s22 8 22 20Z" fill="#f46a8e" stroke="#6b3a22" strokeWidth="5" />
      <g strokeWidth="5" strokeLinecap="round">
        <path d="M48 60l6 4" stroke="#8fddbe" />
        <path d="M66 56l-5 6" stroke="#ffd23f" />
        <path d="M54 80l7-2" stroke="#5fb8ff" />
        <path d="M70 76l2 7" stroke="#f46a8e" />
        <path d="M48 92l6 3" stroke="#ffd23f" />
      </g>
      <g fill="#6b3a22">
        <circle cx="50" cy="12" r="3" />
        <circle cx="60" cy="8" r="3" />
        <circle cx="70" cy="12" r="3" />
      </g>
    </svg>
  );
}

export function Bell({ size = 300 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <ellipse cx="100" cy="170" rx="80" ry="14" fill="#6b3a22" opacity=".18" />
      <rect x="22" y="146" width="156" height="20" rx="10" fill="#b07a2a" stroke="#6b3a22" strokeWidth="5" />
      <path d="M36 146c0-50 28-82 64-82s64 32 64 82Z" fill="#e3b04b" stroke="#6b3a22" strokeWidth="5" />
      <path d="M60 122c2-26 16-42 32-46" stroke="#fff4c8" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".8" />
      <rect x="90" y="44" width="20" height="22" rx="6" fill="#b07a2a" stroke="#6b3a22" strokeWidth="5" />
      <circle cx="100" cy="38" r="12" fill="#e3b04b" stroke="#6b3a22" strokeWidth="5" />
    </svg>
  );
}
