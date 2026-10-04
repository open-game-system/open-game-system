// A game's capture inside OGS chrome, HUD-safe (see frame.ts). Fills its parent.
import { DuelArt } from "../ui/GameArt";
import { frameFor, heroFor } from "./frame";

export function TvArt({ gameId, className }: { gameId: string; className?: string }) {
  const f = frameFor(gameId);
  if (!f) return <DuelArt className={className} />;
  return (
    <span className={`ct-art ${className ?? ""}`}>
      <img src={f.src} alt="" style={{ transform: `scale(${f.scale})`, transformOrigin: `${f.ox}% ${f.oy}%` }} />
    </span>
  );
}

/** The console home's hero art, sharp and HUD-free (see heroFor). */
export function HeroArt({ gameId }: { gameId: string }) {
  const h = heroFor(gameId);
  if (!h) return <DuelArt />;
  return (
    <span className="ct-hero">
      <img src={h.src} alt="" style={{ transform: `translate(${h.x}px, ${h.y}px) scale(${h.k})` }} />
    </span>
  );
}
