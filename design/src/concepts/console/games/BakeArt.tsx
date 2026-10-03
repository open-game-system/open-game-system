// Stand-in art for Bake Shop's own controller views. Soft toy bakery: butter cream, strawberry, mint.
// Props have no faces.

export function Cupcake({ size = 160, berry = true, sprinkles = true, frosted = true, frosting = "#f9c6d3" }: { size?: number; berry?: boolean; sprinkles?: boolean; frosted?: boolean; frosting?: string }) {
  const dots: [number, number, string][] = [
    [38, 44, "#8fddbe"], [52, 36, "#ffd23f"], [64, 46, "#6fb7f0"], [46, 54, "#f46a8e"], [72, 38, "#8fddbe"], [30, 52, "#ffd23f"], [58, 58, "#6fb7f0"],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M22 60h56l-7 32H29z" fill="#f4b183" />
      <path d="M30 60l3 32M42 60l1 32M54 60l-1 32M66 60l-3 32" stroke="#d98a5a" strokeWidth="2.4" />
      {frosted ? (
        <g className="bk-frost">
          <path d="M18 62c0-12 10-16 16-16 0-12 10-18 16-18s16 6 16 18c6 0 16 4 16 16z" fill={frosting} />
          <path d="M26 60c4-6 10-8 16-6M50 44c6-4 12-4 16 2" stroke="#fff" strokeOpacity=".7" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      ) : (
        <path d="M22 62c0-10 12-16 28-16s28 6 28 16z" fill="#e9a66f" />
      )}
      {sprinkles && frosted && dots.map(([x, y, c], i) => <rect key={i} x={x} y={y} width="6" height="2.6" rx="1.3" fill={c} transform={`rotate(${i * 37} ${x + 3} ${y + 1})`} />)}
      {berry && (
        <g className="bk-berry">
          <path d="M50 12c8 0 13 6 11 14-2 7-7 12-11 14-4-2-9-7-11-14-2-8 3-14 11-14z" fill="#e8384f" />
          <path d="M43 13c3-5 11-5 14 0-4 2-10 2-14 0z" fill="#3fae6a" />
          <circle cx="46" cy="22" r="1" fill="#ffe08a" />
          <circle cx="54" cy="21" r="1" fill="#ffe08a" />
          <circle cx="50" cy="29" r="1" fill="#ffe08a" />
        </g>
      )}
    </svg>
  );
}

export function Strawberry({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 22c20 0 32 12 28 30-4 18-16 32-28 38-12-6-24-20-28-38-4-18 8-30 28-30z" fill="#e8384f" />
      <path d="M30 22c8-10 32-10 40 0-8 6-32 6-40 0z" fill="#3fae6a" />
      <path d="M50 8v12" stroke="#3fae6a" strokeWidth="5" strokeLinecap="round" />
      {[[38, 40], [52, 36], [64, 44], [44, 56], [58, 58], [50, 74], [36, 62]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="2.2" ry="3" fill="#ffe08a" />
      ))}
    </svg>
  );
}

const SHAKE: [number, number, string][] = [[38, 50, "#8fddbe"], [52, 44, "#ffd23f"], [60, 60, "#6fb7f0"], [44, 68, "#f46a8e"], [56, 76, "#8fddbe"], [40, 80, "#ffd23f"]];

export function Shaker({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <rect x="28" y="30" width="44" height="60" rx="10" fill="#fff8ea" stroke="#e9cfa6" strokeWidth="3" />
      <rect x="30" y="16" width="40" height="16" rx="6" fill="#f46a8e" />
      {[[36, 20], [46, 20], [56, 20], [41, 26], [51, 26], [61, 26]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.8" fill="#fff" />
      ))}
      {SHAKE.map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width="9" height="3.6" rx="1.8" fill={c} transform={`rotate(${i * 41} ${x + 4} ${y + 2})`} />
      ))}
    </svg>
  );
}

export function Swirl({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 88L30 50h40z" fill="#f4b183" />
      <path d="M24 52c0-8 8-12 14-12 0-10 6-16 12-16s12 6 12 16c6 0 14 4 14 12z" fill="#fff4f6" stroke="#f9c6d3" strokeWidth="3" />
      <path d="M36 44c6-4 14-4 20 0M44 32c4-3 8-3 12 0" stroke="#f9c6d3" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Oven({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M14 88V50a36 36 0 0172 0v38z" fill="#c9553b" />
      <path d="M14 60h72M14 74h72M32 50v10M50 46v14M68 50v10M24 60v14M42 60v14M60 60v14M78 60v14" stroke="#a8432c" strokeWidth="2" />
      <path d="M30 88V62a20 20 0 0140 0v26z" fill="#3a1d12" />
      <path d="M38 88c0-10 6-18 12-22 6 4 12 12 12 22z" fill="#ffb347" />
      <path d="M44 88c0-6 3-10 6-12 3 2 6 6 6 12z" fill="#fff1a8" />
    </svg>
  );
}
