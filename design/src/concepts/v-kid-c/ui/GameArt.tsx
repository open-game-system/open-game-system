// A game's own art, cropped for a tile. Word Duel has no captures, so its tile is drawn from its
// own look (letter tiles on cream), never initials-in-squares.
import { gameById } from "../../../world";

export function GameArt({ gameId, className, alt = false }: { gameId: string; className?: string; alt?: boolean }) {
  const g = gameById(gameId);
  const src = alt ? (g.art.alt ?? g.art.tv) : g.art.tv;
  if (!src) return <DuelArt className={className} />;
  return <img className={`cx-art ${className ?? ""}`} src={src} alt="" />;
}

export function DuelArt({ className }: { className?: string }) {
  const tiles: [string, number, number, number][] = [
    ["Q", 18, 30, -6], ["U", 40, 26, 3], ["I", 62, 30, -2], ["L", 84, 27, 5], ["T", 106, 31, -4],
    ["F", 34, 54, 4], ["E", 56, 56, -3], ["R", 78, 53, 2], ["N", 100, 57, -5],
  ];
  return (
    <svg className={`cx-art ${className ?? ""}`} viewBox="0 0 140 90" preserveAspectRatio="xMidYMid slice" aria-hidden style={{ background: "#f4efe4" }}>
      <defs>
        <pattern id="wd-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke="#1d1b16" strokeOpacity=".07" />
        </pattern>
      </defs>
      <rect width="140" height="90" fill="url(#wd-grid)" />
      {tiles.map(([ch, x, y, r], i) => (
        <g key={i} transform={`rotate(${r} ${x + 9} ${y + 9})`}>
          <rect x={x} y={y + 1.5} width="18" height="18" rx="2.5" fill="#d8ccb2" />
          <rect x={x} y={y} width="18" height="18" rx="2.5" fill={i === 4 ? "#2f6fc8" : "#fffaf0"} stroke="#d8ccb2" />
          <text x={x + 9} y={y + 13.5} textAnchor="middle" fontFamily="Schibsted Grotesk, sans-serif" fontWeight="800" fontSize="11" fill={i === 4 ? "#fff" : "#1d1b16"}>
            {ch}
          </text>
        </g>
      ))}
    </svg>
  );
}
