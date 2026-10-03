// Props drawn for the stand-in game controllers. No faces on objects, ever.
export function Star({ size = 40, fill = "#ffd23f", dim = false }: { size?: number; fill?: string; dim?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1.8l3.1 6.6 7.1.8-5.3 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1L1.8 9.2l7.1-.8z" fill={dim ? "none" : fill} stroke={dim ? "#fff6e066" : "#b8860b"} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function Arrow({ dir, size = 56 }: { dir: "left" | "right"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: dir === "left" ? "scaleX(-1)" : undefined }}>
      <path d="M8 4l9 8-9 8z" fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function Strawberry({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 92C26 80 14 58 20 40c5-13 19-17 30-12 11-5 25-1 30 12 6 18-6 40-30 52z" fill="#f04a6b" />
      <path d="M50 92C34 82 26 66 28 50" fill="none" stroke="#ff8aa3" strokeWidth="5" strokeLinecap="round" opacity=".6" />
      {[[38, 46], [56, 44], [46, 58], [64, 58], [36, 64], [54, 72], [44, 78], [66, 46]].map(([x, y]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx="2" ry="3" fill="#ffe7a8" />
      ))}
      <path d="M50 30c-8-10-20-8-24-2 8 0 14 2 18 6-8-2-14 2-16 8 8-6 16-6 22-4 6-2 14-2 22 4-2-6-8-10-16-8 4-4 10-6 18-6-4-6-16-8-24 2z" fill="#4fae6a" />
    </svg>
  );
}

export function Cream({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M18 74c0-8 8-12 16-12-4-8 4-16 12-14-2-10 8-18 16-14 2-8 12-10 14-2-4 6 4 10 0 18 8 0 12 10 6 16 8 2 10 12 2 16H24c-6 0-6-6-6-8z" fill="#fffaf0" stroke="#e7cfa8" strokeWidth="3" strokeLinejoin="round" />
      <path d="M30 70c10 4 30 4 42-2M40 56c8 3 18 3 26-1" fill="none" stroke="#e7cfa8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Sprinkles({ size = 120 }: { size?: number }) {
  const bits: [number, number, number, string][] = [
    [30, 22, 30, "#f46a8e"], [50, 14, -20, "#8fddbe"], [68, 24, 50, "#ffd23f"], [40, 34, -40, "#7bb6ff"], [60, 36, 10, "#f46a8e"],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="28" y="46" width="44" height="46" rx="10" fill="#8fddbe" stroke="#4f9f86" strokeWidth="3" />
      <rect x="24" y="40" width="52" height="12" rx="6" fill="#fff1d6" stroke="#4f9f86" strokeWidth="3" />
      {bits.map(([x, y, r, c]) => (
        <rect key={`${x}${y}`} x={x} y={y} width="12" height="5" rx="2.5" fill={c} transform={`rotate(${r} ${x + 6} ${y + 2.5})`} />
      ))}
    </svg>
  );
}

export function Cupcake({ size = 220, layers = 3 }: { size?: number; layers?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M24 56h52l-7 36H31z" fill="#e9a86b" stroke="#b9733d" strokeWidth="2.5" strokeLinejoin="round" />
      {[34, 44, 56, 66].map((x) => (
        <path key={x} d={`M${x} 58l2 32`} stroke="#b9733d" strokeWidth="2" opacity=".5" />
      ))}
      {layers > 0 && <path d="M20 58c-4-12 8-18 16-16 2-10 16-14 22-6 8-6 22 0 20 10 8 0 10 10 2 12z" fill="#ffd0dc" stroke="#e48aa2" strokeWidth="2.5" strokeLinejoin="round" />}
      {layers > 1 && <path d="M32 38c0-10 10-14 18-10 6-6 18-2 16 8" fill="#fff6ea" stroke="#e7cfa8" strokeWidth="2.5" />}
      {layers > 2 &&
        [[30, 48, 20, "#f46a8e"], [44, 44, -30, "#8fddbe"], [58, 46, 40, "#ffd23f"], [68, 52, -10, "#7bb6ff"], [38, 54, 60, "#8fddbe"], [52, 54, 0, "#f46a8e"]].map(([x, y, r, c]) => (
          <rect key={`${x}${y}`} x={Number(x)} y={Number(y)} width="7" height="3" rx="1.5" fill={String(c)} transform={`rotate(${r} ${Number(x) + 3.5} ${Number(y) + 1.5})`} />
        ))}
      {layers > 3 && <circle cx="50" cy="26" r="7" fill="#f04a6b" stroke="#b8304d" strokeWidth="2" />}
    </svg>
  );
}

export function Bell({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 18h16M6 18c0-6 2.5-9 6-9s6 3 6 9M12 9V6.5M10.5 6h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
