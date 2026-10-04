// A game box seen spine-out on the shelf: the game's own colours, a slice of its cover at the
// end, its name, and the resume point written on it. On a kid iPad the spine carries no words:
// cover slice and the stickers of who played it.
import type { CSSProperties, ReactNode } from "react";
import { gameById, type Person } from "../../../world";
import { Portrait } from "../ui/Brand";
import { GameArt } from "../ui/GameArt";
import type { SpineText } from "./model";

export function spineStyle(gameId: string): CSSProperties {
  const p = gameById(gameId).palette;
  return { "--sp-ground": p.ground, "--sp-ink": p.ink, "--sp-accent": p.accent, "--sp-accent2": p.accent2 };
}

export function Spine({
  gameId,
  text,
  people = [],
  className = "",
  sticker = 28,
  tail,
}: {
  gameId: string;
  /** No text on kid iPads. */
  text?: SpineText;
  people?: Person[];
  className?: string;
  sticker?: number;
  tail?: ReactNode;
}) {
  const g = gameById(gameId);
  return (
    <span className={`sp ${className}`} style={spineStyle(gameId)}>
      <span className="sp__cover" aria-hidden>
        <GameArt gameId={gameId} alt />
      </span>
      {text && (
        <span className="sp__text">
          <b>{g.name}</b>
          <span>
            {text.point}
            {text.when ? ` · ${text.when}` : ""}
          </span>
        </span>
      )}
      {people.length > 0 && (
        <span className="sp__who">
          {people.map((p) => (
            <Portrait key={p.id} person={p} size={sticker} />
          ))}
        </span>
      )}
      {tail}
    </span>
  );
}
