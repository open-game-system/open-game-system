// A game's cover: the game's own art, palette and type, bound to the spine by a stitched
// binding and a status tag in the spine's voice. Every cover follows this one recipe.
import type { CSSProperties, ReactNode } from "react";
import type { GameManifest } from "../../../world";
import type { CoverKind, CoverStatus } from "../covers";
import { skinOf, skinVars } from "../skin";

export function Tag({ status, style }: { status: Pick<CoverStatus, "kind" | "tag">; style?: CSSProperties }) {
  return (
    <span className="sp-tag" style={style}>
      <Bead kind={status.kind} />
      <span>{status.tag}</span>
    </span>
  );
}

export function Bead({ kind }: { kind: CoverKind }) {
  if (kind === "live") return <span className="sp-bead" />;
  if (kind === "turn" || kind === "ready") return <span className="sp-bead is-turn" />;
  if (kind === "soon") return <span className="sp-bead is-wait" />;
  return null;
}

/** The game's art, or (no art shipped) its name set in the game's own type and palette. */
export function CoverArt({ g, alt, position = "center", style }: { g: GameManifest; alt?: boolean; position?: string; style?: CSSProperties }) {
  const src = alt ? (g.art.alt ?? g.art.tv) : g.art.tv;
  if (src) return <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: position, ...style }} />;
  return <TypeCover g={g} style={style} />;
}

export function TypeCover({ g, style }: { g: GameManifest; style?: CSSProperties }) {
  const k = skinOf(g);
  const letters = g.name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4).split("");
  return (
    <div aria-hidden style={{ width: "100%", height: "100%", background: k.accent, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...style }}>
      {letters.map((l, i) => (
        <span
          key={i}
          style={{
            width: 38, height: 42, borderRadius: k.radius, background: k.ground, color: k.ink, display: "grid", placeItems: "center",
            font: `800 24px ${k.display}`, boxShadow: "0 3px 0 rgba(0,0,0,.28)", transform: `rotate(${(i % 2 ? 1 : -1) * (2 + i)}deg)`,
          }}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

/** Shared frame: binding on the left, skin vars on the subtree. */
export function Bound({ g, children, style, bot, onClick, label }: { g: GameManifest; children: ReactNode; style?: CSSProperties; bot?: string; onClick?: () => void; label?: string }) {
  const k = skinOf(g);
  const frame: CSSProperties = {
    ...skinVars(k), position: "relative", display: "block", width: "100%", textAlign: "left", overflow: "hidden",
    background: k.ground, color: k.onGround, borderRadius: `0 ${Math.min(k.radius, 16)}px ${Math.min(k.radius, 16)}px 0`,
    boxShadow: "0 1px 0 rgba(0,0,0,.08), 0 8px 18px -10px rgba(40,30,10,.45)", ...style,
  };
  const inner = (
    <>
      {children}
      <span className="sp-binding" />
    </>
  );
  if (onClick) return <button data-bot={bot} onClick={onClick} style={frame} aria-label={label}>{inner}</button>;
  return <article style={frame}>{inner}</article>;
}
