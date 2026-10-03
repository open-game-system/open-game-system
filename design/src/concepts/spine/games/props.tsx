// Stand-in props drawn for the games' own controllers (no faces on objects).
interface P { size?: number }

export const Star = ({ size = 40, fill = "#ffd23f", stroke = "none" }: P & { fill?: string; stroke?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
    <path d="M20 2.5l5.3 11.3 12.2 1.5-9 8.5 2.3 12.2L20 30.1 9.2 36l2.3-12.2-9-8.5 12.2-1.5z" fill={fill} stroke={stroke} strokeWidth={stroke === "none" ? 0 : 2.5} strokeLinejoin="round" />
  </svg>
);

export const Strawberry = ({ size = 120 }: P) => (
  <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
    <path d="M60 108C30 96 16 70 20 50c4-16 20-22 40-16 20-6 36 0 40 16 4 20-10 46-40 58z" fill="#ef4a5f" />
    <path d="M60 108C30 96 16 70 20 50c2-8 7-13 14-15-6 18 2 50 26 73z" fill="#d63a50" />
    {[[40, 56], [60, 52], [80, 56], [48, 72], [70, 72], [58, 88], [36, 76], [84, 74]].map(([x, y], i) => (
      <ellipse key={i} cx={x} cy={y} rx="2.6" ry="3.6" fill="#ffe28a" />
    ))}
    <path d="M60 36c-8-10-22-12-28-6 10 0 16 4 20 9-10-2-18 2-20 8 10-4 20-4 28-2 8-2 18-2 28 2-2-6-10-10-20-8 4-5 10-9 20-9-6-6-20-4-28 6z" fill="#3fae6a" />
    <rect x="57" y="14" width="6" height="18" rx="3" fill="#2d8a51" />
  </svg>
);

export const Sprinkles = ({ size = 120 }: P) => (
  <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
    <rect x="30" y="34" width="60" height="74" rx="14" fill="#fffaf0" stroke="#e9d9bd" strokeWidth="3" />
    <rect x="34" y="18" width="52" height="20" rx="8" fill="#f46a8e" />
    {[[42, 54, "#f46a8e", 20], [62, 50, "#8fddbe", -30], [76, 62, "#ffd23f", 40], [48, 74, "#7b6ad6", -10], [68, 80, "#f46a8e", 60], [44, 94, "#ffd23f", -40], [72, 96, "#8fddbe", 15], [58, 66, "#ff9b5e", 80]].map(([x, y, c, r], i) => (
      <rect key={i} x={Number(x) - 7} y={Number(y) - 3} width="14" height="6" rx="3" fill={String(c)} transform={`rotate(${r} ${x} ${y})`} />
    ))}
    {[44, 56, 68, 80].map((x) => <circle key={x} cx={x - 4} cy="28" r="2.4" fill="#fff1d6" />)}
  </svg>
);

export const Frosting = ({ size = 120 }: P) => (
  <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
    <path d="M18 92c0-10 10-16 22-16h40c12 0 22 6 22 16 0 8-8 12-16 12H34c-8 0-16-4-16-12z" fill="#ffc2d1" />
    <path d="M28 76c0-10 10-16 20-16h24c10 0 20 6 20 16z" fill="#ffd3de" />
    <path d="M38 60c0-10 10-16 22-16s22 6 22 16z" fill="#ffe3ea" />
    <path d="M52 44c0-10 4-22 14-26-2 8 4 14 4 22 0 3-1 4-2 4z" fill="#fff1f4" />
    <path d="M30 92h60M38 76h44" stroke="#f9a8bc" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** The cupcake being built: base always; frosting and toppings as added. */
export const Cupcake = ({ size = 220, frosting = true, berry = false, sprinkles = false }: P & { frosting?: boolean; berry?: boolean; sprinkles?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 220 220" aria-hidden>
    <ellipse cx="110" cy="200" rx="70" ry="10" fill="rgba(107,58,34,.18)" />
    <path d="M52 112h116l-14 82c-1 6-6 10-12 10H78c-6 0-11-4-12-10z" fill="#f5b7c4" />
    {[70, 92, 114, 136, 158].map((x) => <path key={x} d={`M${x - 4} 114l${x < 110 ? 4 : -2} 88`} stroke="#e48ea3" strokeWidth="5" strokeLinecap="round" />)}
    {frosting && (
      <>
        <path d="M44 118c-10-26 14-44 30-40 0-26 30-38 46-24 18-14 48-2 46 24 18-2 34 18 22 40z" fill="#fff4f6" />
        <path d="M60 110c-4-12 6-20 16-18M112 64c10-4 22 2 24 12M150 98c8 0 14 6 14 12" stroke="#f6d3dc" strokeWidth="5" fill="none" strokeLinecap="round" />
      </>
    )}
    {sprinkles &&
      [[72, 92, "#f46a8e", 30], [96, 76, "#8fddbe", -20], [128, 72, "#ffd23f", 50], [150, 94, "#7b6ad6", -40], [112, 100, "#ff9b5e", 10], [86, 106, "#8fddbe", 70], [140, 110, "#f46a8e", -10]].map(([x, y, c, r], i) => (
        <rect key={i} x={Number(x) - 8} y={Number(y) - 3.5} width="16" height="7" rx="3.5" fill={String(c)} transform={`rotate(${r} ${x} ${y})`} />
      ))}
    {berry && (
      <g transform="translate(84 18) scale(.44)">
        <path d="M60 108C30 96 16 70 20 50c4-16 20-22 40-16 20-6 36 0 40 16 4 20-10 46-40 58z" fill="#ef4a5f" />
        <path d="M60 36c-8-10-22-12-28-6 10 0 16 4 20 9-10-2-18 2-20 8 10-4 20-4 28-2 8-2 18-2 28 2-2-6-10-10-20-8 4-5 10-9 20-9-6-6-20-4-28 6z" fill="#3fae6a" />
      </g>
    )}
  </svg>
);

export const Ring = ({ size = 120, color = "#fff" }: P & { color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
    <circle cx="60" cy="60" r="44" fill="none" stroke={color} strokeWidth="16" />
  </svg>
);

export const Triangle = ({ size = 120, color = "#fff" }: P & { color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
    <path d="M60 14l50 88H10z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth="10" />
  </svg>
);
