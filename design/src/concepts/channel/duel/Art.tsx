// Word Duel has no art of its own: a tiny board, drawn, stands in as its key art (no letters, no initials).
export function DuelArt({ className = "" }: { className?: string }) {
  const tiles: [number, number, string][] = [
    [1, 2, "#2f6fc8"], [2, 2, "#2f6fc8"], [3, 2, "#2f6fc8"], [3, 3, "#e08a1e"], [3, 4, "#e08a1e"], [3, 5, "#e08a1e"], [4, 5, "#2f6fc8"], [5, 5, "#2f6fc8"],
  ];
  return (
    <svg className={className} viewBox="0 0 80 56" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="80" height="56" fill="#f4efe4" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`v${i}`} x1={8 + i * 8} y1="0" x2={8 + i * 8} y2="56" stroke="#1d1b1622" strokeWidth="0.6" />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={4 + i * 8} x2="80" y2={4 + i * 8} stroke="#1d1b1622" strokeWidth="0.6" />
      ))}
      {tiles.map(([r, c, col]) => (
        <rect key={`${r}-${c}`} x={8 + c * 8 + 0.8} y={4 + r * 8 - 7.2} width="6.4" height="6.4" rx="1" fill={col} />
      ))}
    </svg>
  );
}
