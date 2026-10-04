import type { GameManifest } from "../../world";
import { personOf } from "./state";
import type { Glyph } from "./fixtures";

export function Sticker({ pid, size, ring, dim, className }: { pid: string; size: number; ring?: boolean; dim?: boolean; className?: string }) {
  const p = personOf(pid);
  return (
    <span
      className={`sw-sticker ${ring ? "is-ring" : ""} ${dim ? "is-dim" : ""} ${className ?? ""}`}
      style={{ width: size, height: size, "--pc": p.color }}
    >
      <img src={p.sticker} alt={p.name} />
    </span>
  );
}

export function StickerImg({ src, size, color }: { src: string; size: number; color: string }) {
  return (
    <span className="sw-sticker" style={{ width: size, height: size, "--pc": color }}>
      <img src={src} alt="" />
    </span>
  );
}

type IconName = "home" | "list" | "cast" | "pause" | "check" | "tv" | "phone" | "ipad" | "turns" | "night" | "family" | "stop" | "up" | "down" | "left" | "right" | "plus" | "moon" | "pad" | "wifi" | "sleep" | "back";

export function Icon({ name, size = 24, color = "currentColor" }: { name: IconName; size?: number; color?: string }) {
  const p = { fill: "none", stroke: color, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const body = (() => {
    switch (name) {
      case "home": return <path {...p} d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />;
      case "list": return <g {...p}><rect x="3.5" y="4" width="7" height="7" rx="2" /><rect x="13.5" y="4" width="7" height="7" rx="2" /><rect x="3.5" y="14" width="7" height="7" rx="2" /><rect x="13.5" y="14" width="7" height="7" rx="2" /></g>;
      case "cast": return <g {...p}><path d="M3 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" /><path d="M3 12a8 8 0 0 1 8 8M3 16a4 4 0 0 1 4 4" /><circle cx="3.5" cy="20" r=".8" fill={color} /></g>;
      case "pause": return <g fill={color}><rect x="6" y="4.5" width="4" height="15" rx="1.5" /><rect x="14" y="4.5" width="4" height="15" rx="1.5" /></g>;
      case "check": return <path {...p} strokeWidth={3.2} d="m5 12.5 4.5 4.5L19 7.5" />;
      case "tv": return <g {...p}><rect x="2.5" y="4.5" width="19" height="13" rx="2.5" /><path d="M8 21h8" /></g>;
      case "phone": return <g {...p}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></g>;
      case "ipad": return <g {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M18.5 12h.01" /></g>;
      case "turns": return <g {...p}><rect x="3" y="7" width="7" height="7" rx="1.5" /><rect x="14" y="7" width="7" height="7" rx="1.5" /><path d="M6.5 17.5h11" /></g>;
      case "night": return <g {...p}><path d="M4 18c3-1 5-4 8-4s5 3 8 4" /><path d="M12 14V5l5 3-5 2" /></g>;
      case "family": return <g {...p}><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9.5" r="2.4" /><path d="M2.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M13.5 19c.4-2.4 1.6-3.8 3-3.8s2.8 1.4 3.3 3.8" /></g>;
      case "stop": return <g {...p}><rect x="2.5" y="4.5" width="19" height="13" rx="2.5" /><path d="m9.5 8.5 5 5m0-5-5 5" /></g>;
      case "up": return <path fill={color} d="M12 5 20 16H4z" />;
      case "down": return <path fill={color} d="M12 19 4 8h16z" />;
      case "left": return <path fill={color} d="M5 12 16 4v16z" />;
      case "right": return <path fill={color} d="M19 12 8 20V4z" />;
      case "plus": return <path {...p} d="M12 5v14M5 12h14" />;
      case "moon": return <path fill={color} d="M15.5 3.5a8.5 8.5 0 1 0 5 15A7 7 0 0 1 15.5 3.5z" />;
      case "pad": return <g fill={color}><rect x="9" y="3" width="6" height="18" rx="1.5" /><rect x="3" y="9" width="18" height="6" rx="1.5" /></g>;
      case "wifi": return <g {...p}><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a4.6 4.6 0 0 1 6.4 0" /><circle cx="12" cy="19.2" r=".9" fill={color} /></g>;
      case "sleep": return <g {...p}><path d="M5 5h5l-5 6h5M13 11h6l-6 8h6" /></g>;
      case "back": return <path {...p} d="M15 5 8 12l7 7" />;
    }
  })();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      {body}
    </svg>
  );
}

/** A game's tile art. Word Duel has no capture, so its tile is its own look: tiles on a board. */
export function GameArt({ g, className }: { g: GameManifest; className?: string }) {
  if (g.art.tv) return <img className={`sw-art ${className ?? ""}`} src={g.art.tv} alt="" />;
  const across = "WORD".split("");
  const down = "DUEL".split("");
  return (
    <span className={`sw-art sw-duelart ${className ?? ""}`} aria-hidden="true" style={{ background: g.palette.ground }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="sw-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="none" stroke="#d9cfb9" strokeWidth=".6" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#sw-grid)" />
        <rect x="40" y="40" width="10" height="10" fill={g.palette.accent} opacity=".25" />
        {across.map((c, i) => (
          <g key={`a${i}`}>
            <rect x={20 + i * 10 + 0.8} y={30.8} width={8.4} height={8.4} rx={1.4} fill="#fffaf0" stroke={g.palette.ink} strokeWidth=".5" />
            <text x={25 + i * 10} y={37.6} textAnchor="middle" fontSize="6.4" fontWeight="800" fill={g.palette.ink} fontFamily="M PLUS Rounded 1c, system-ui">{c}</text>
          </g>
        ))}
        {down.slice(1).map((c, i) => (
          <g key={`d${i}`}>
            <rect x={50.8} y={40 + i * 10 + 0.8} width={8.4} height={8.4} rx={1.4} fill={i === 1 ? g.palette.accent2 : "#fffaf0"} stroke={g.palette.ink} strokeWidth=".5" />
            <text x={55} y={47.6 + i * 10} textAnchor="middle" fontSize="6.4" fontWeight="800" fill={g.palette.ink} fontFamily="M PLUS Rounded 1c, system-ui">{c}</text>
          </g>
        ))}
      </svg>
    </span>
  );
}

/** Wordless kid-pad shapes (no faces). */
export function GlyphShape({ name, color, size }: { name: Glyph; color: string; size: number }) {
  const w = "#fffaf0";
  const shape = (() => {
    switch (name) {
      case "bolt": return <path fill={w} d="M54 8 22 56h22l-6 36 34-50H50z" />;
      case "gear": return <g fill={w}><circle cx="50" cy="50" r="22" /><g>{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <rect key={a} x="44" y="12" width="12" height="18" rx="3" transform={`rotate(${a} 50 50)`} />)}</g><circle cx="50" cy="50" r="9" fill={color} /></g>;
      case "star": return <path fill={w} d="m50 10 11 25 27 3-20 18 6 27-24-14-24 14 6-27-20-18 27-3z" />;
      case "berry": return <g><path fill={w} d="M50 30c18 0 30 8 30 22 0 18-16 36-30 38-14-2-30-20-30-38 0-14 12-22 30-22z" /><g fill={color}>{[[40, 48], [58, 46], [48, 60], [62, 64], [38, 66], [50, 76]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="2.6" ry="3.6" />)}</g><path fill={w} d="M38 26c4-8 8-10 12-10s8 2 12 10c-6-3-18-3-24 0z" /></g>;
      case "swirl": return <path fill="none" stroke={w} strokeWidth="9" strokeLinecap="round" d="M50 52c0-4 6-4 6 0 0 8-12 8-12 0 0-12 18-12 18 0 0 16-24 16-24 0 0-20 30-20 30 0" />;
      case "sprinkle": return <g stroke={w} strokeWidth="8" strokeLinecap="round">{[[30, 30, 40, 22], [60, 26, 70, 34], [26, 56, 34, 66], [52, 50, 62, 44], [70, 66, 62, 76], [44, 74, 50, 82]].map(([a, b, c, d]) => <line key={`${a}${b}`} x1={a} y1={b} x2={c} y2={d} />)}</g>;
      case "spoon": return <g fill={w}><ellipse cx="50" cy="32" rx="16" ry="20" /><rect x="45" y="48" width="10" height="40" rx="5" /></g>;
      case "moon": return <path fill={w} d="M62 14a36 36 0 1 0 24 58A30 30 0 0 1 62 14z" />;
      case "leaf": return <path fill={w} d="M20 80C20 40 44 18 84 16 82 56 60 80 20 80zm8-6c14-14 26-26 40-44" />;
      case "drop": return <path fill={w} d="M50 12c14 22 26 36 26 52a26 26 0 0 1-52 0c0-16 12-30 26-52z" />;
    }
  })();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {shape}
    </svg>
  );
}

