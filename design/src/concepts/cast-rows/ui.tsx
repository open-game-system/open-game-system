import type { CSSProperties, ReactNode } from "react";
import type { GameManifest } from "../../world";
import { personOf } from "./state";

export function Sticker({ id, size, dim, src, color }: { id?: string; size: number; dim?: boolean; src?: string; color?: string }) {
  const p = id ? personOf(id) : undefined;
  const c = color ?? p?.color ?? "#555";
  const s = src ?? p?.sticker ?? "";
  return (
    <span className="cr-stk" style={{ width: size, height: size, background: `radial-gradient(circle at 50% 40%, ${c}66, ${c}22 70%)`, opacity: dim ? 0.45 : 1 }}>
      <img src={s} alt="" />
    </span>
  );
}

/** Key art cropped to its HUD-safe area (manifest config), so OGS chrome never meets the game's HUD. */
export function Art({ game, alt, style, className, tile }: { game: GameManifest; alt?: boolean; style?: CSSProperties; className?: string; tile?: number }) {
  const src = (alt ? game.art.alt : undefined) ?? game.art.tv;
  const safe = game.art.safe;
  const st: CSSProperties = safe ? { transform: `scale(${safe.scale})`, transformOrigin: `${safe.ox}% ${safe.oy}%`, ...style } : { ...style };
  if (!src) return <DuelArt game={game} tile={tile} />;
  return <img className={className} src={src} alt="" style={st} />;
}

/** A game with no art (Word Duel): its own paper and tiles, never initials. */
export function DuelArt({ game, word = "DUEL", tile = 64 }: { game: GameManifest; word?: string; tile?: number }) {
  return (
    <span style={{ position: "absolute", inset: 0, background: game.palette.ground, display: "flex", alignItems: "center", justifyContent: "center", gap: tile * 0.14 }}>
      {word.split("").map((l, i) => (
        <span key={i} style={{ width: tile, height: tile, borderRadius: tile * 0.16, background: "#fffaf0", boxShadow: "0 3px 0 #d4c7ad", display: "grid", placeItems: "center", color: game.palette.ink, font: `800 ${Math.round(tile * 0.55)}px Geist, sans-serif`, transform: `rotate(${(i % 2 ? 1 : -1) * 3}deg)` }}>
          {l}
        </span>
      ))}
    </span>
  );
}

type IconName = "home" | "back" | "keyboard" | "play" | "check" | "tv" | "phone" | "up" | "down" | "left" | "right" | "plus" | "browse" | "remote" | "pause" | "search" | "refresh";

export function Icon({ name, size = 22, color = "currentColor", stroke = 2.4 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const p = { fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, ReactNode> = {
    home: <path {...p} d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
    back: <path {...p} d="M10 6 4 12l6 6M4.5 12H20" />,
    keyboard: (
      <g {...p}>
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M8 14.5h8" />
      </g>
    ),
    play: <path d="M8 5.5v13l11-6.5z" fill={color} />,
    pause: <path d="M8 5v14M16 5v14" {...p} strokeWidth={stroke * 1.6} />,
    check: <path {...p} d="m5 12.5 4.5 4.5L19 7.5" />,
    tv: (
      <g {...p}>
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M8 21h8" />
      </g>
    ),
    phone: <rect {...p} x="7" y="3" width="10" height="18" rx="2.5" />,
    up: <path {...p} d="m6 15 6-6 6 6" />,
    down: <path {...p} d="m6 9 6 6 6-6" />,
    left: <path {...p} d="m15 6-6 6 6 6" />,
    right: <path {...p} d="m9 6 6 6-6 6" />,
    plus: <path {...p} d="M12 5v14M5 12h14" />,
    browse: (
      <g {...p}>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </g>
    ),
    remote: (
      <g {...p}>
        <rect x="6" y="2.5" width="12" height="19" rx="6" />
        <circle cx="12" cy="9" r="2.5" />
      </g>
    ),
    search: (
      <g {...p}>
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 4 4" />
      </g>
    ),
    refresh: <path {...p} d="M19 12a7 7 0 1 1-2.05-4.95M19 5v4h-4" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flex: "none" }}>
      {paths[name]}
    </svg>
  );
}

/** The OGS mark: a rounded screen with a lit corner (a TV that's on). */
export function Mark({ label = true }: { label?: boolean }) {
  return (
    <span className="tv-mark">
      <i />
      {label ? "Open Game" : null}
    </span>
  );
}

export const relTime = (iso: string): string => {
  const now = new Date("2026-10-03T19:10:00-07:00").getTime();
  const t = new Date(iso).getTime();
  const m = Math.round((now - t) / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const d = Math.round(h / 24);
  return d < 7 ? days[new Date(iso).getDay()] ?? "" : `${d} days ago`;
};
