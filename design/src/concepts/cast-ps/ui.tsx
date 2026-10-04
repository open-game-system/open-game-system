// Shared bits: stickers, a game's art (with its HUD-safe crop), and art for games that ship none.
import type { CSSProperties } from "react";
import type { GameManifest } from "../../world";

export function Sticker({ src, size, ring, dim, style }: { src: string; size: number; ring?: string; dim?: boolean; style?: CSSProperties }) {
  return (
    <span className="cp-sticker" style={{ width: size, height: size, boxShadow: ring ? `0 0 0 ${Math.max(3, size / 22)}px ${ring}` : undefined, opacity: dim ? 0.38 : 1, ...style }}>
      <img src={src} alt="" />
    </span>
  );
}

/** Key art with the manifest's safe crop, or the game's name set in its own palette as tiles. */
export function GameArt({ g, safe, className, style }: { g: GameManifest; safe?: boolean; className?: string; style?: CSSProperties }) {
  if (!g.art.tv) return <TileArt g={g} className={className} style={style} />;
  const crop = safe && g.art.safe ? { transform: `scale(${g.art.safe.scale})`, transformOrigin: `${g.art.safe.ox}% ${g.art.safe.oy}%` } : undefined;
  return (
    <span className={`cp-art ${className ?? ""}`} style={style}>
      <img src={g.art.tv} alt="" style={crop} />
    </span>
  );
}

/** For a game without art (config, not code): its own name as letter tiles on its ground colour. */
export function TileArt({ g, className, style, big }: { g: GameManifest; className?: string; style?: CSSProperties; big?: boolean }) {
  const words = g.name.toUpperCase().split(" ");
  return (
    <span className={`cp-tileart ${big ? "is-big" : ""} ${className ?? ""}`} style={{ background: g.palette.ground, ...style }} aria-hidden>
      <span className="cp-tileart-grid">
        {words.map((w, wi) => (
          <span key={w} className="cp-tileart-row" style={{ marginLeft: `${wi * 1.1}em` }}>
            {[...w].map((ch, i) => (
              <span key={i} className="cp-tile" style={{ background: (i + wi) % 3 === 0 ? g.palette.accent : (i + wi) % 3 === 1 ? "#fffaf0" : g.palette.accent2, color: (i + wi) % 3 === 1 ? g.palette.ink : "#fff" }}>
                {ch}
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}

/** The OGS mark: an open ring (a session that stays open) around a play notch. */
export function Mark({ size = 40, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d="M33 11.5A15 15 0 1 0 35 20" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
      <path d="M16.5 13.5 L27 20 L16.5 26.5Z" fill={color} />
    </svg>
  );
}

export function TvGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <rect x="3" y="5" width="22" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M10 24h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
