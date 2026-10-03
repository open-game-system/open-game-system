// A game's capture inside OGS chrome, HUD-safe (see frame.ts). Fills its parent.
import { DuelArt } from "../ui/GameArt";
import { frameFor } from "./frame";

export function TvArt({ gameId, className }: { gameId: string; className?: string }) {
  const f = frameFor(gameId);
  if (!f) return <DuelArt className={className} />;
  return (
    <span className={`ct-art ${className ?? ""}`}>
      <img src={f.src} alt="" style={{ transform: `scale(${f.scale})`, transformOrigin: `${f.ox}% ${f.oy}%` }} />
    </span>
  );
}
