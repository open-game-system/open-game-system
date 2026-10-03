// A game on the TV. The game owns every pixel; the console only steps in when the phone's console
// button is pressed (the game pauses back into a card) and, right after a switch, with a short
// "now playing" that settles into a corner chip.
import type { CSSProperties } from "react";
import { gameById } from "../../../world";
import { GameTvView } from "../games/registry";
import type { S } from "../state";
import { NightChip } from "./GameNight";
import { NowBand, NowChip } from "./NowPlaying";
import { seatViews } from "./Roster";
import { frameFor } from "./frame";
import { TvArt } from "./TvArt";
import { TvPaused } from "./TvPaused";

export function TvPlaying({ s, gameId }: { s: S; gameId: string }) {
  const f = frameFor(gameId);
  const zoom: CSSProperties = f ? { transform: `scale(${f.scale})`, transformOrigin: `${f.ox}% ${f.oy}%` } : {};
  // Right after a cut the stream starts at the cut-over's HUD-safe zoom and eases out to the game's
  // own full frame as the console's band settles: while OGS chrome is up, no HUD is in view.
  const landing: Record<string, string> = f ? { "--ct-z": String(f.scale), transformOrigin: `${f.ox}% ${f.oy}%` } : {};
  return (
    <div className={`ct-play ${s.menu ? "is-paused" : ""} ${s.left ? "is-landed" : ""}`}>
      <div className="ct-play__blur" aria-hidden>
        <TvArt gameId={gameId} />
      </div>
      <div className="ct-play__game">
        <div className={`ct-play__zoom ${s.left && !s.menu ? "is-landing" : ""}`} style={s.menu ? zoom : s.left ? landing : undefined}>
          <GameTvView gameId={gameId} />
        </div>
      </div>
      {s.menu ? <TvPaused gameId={gameId} /> : <NowOverlay s={s} gameId={gameId} />}
    </div>
  );
}

/** Right after a switch the band holds for a beat, then settles into the corner chip (CSS timeline;
 * shots freeze at its end, the settled frame). Without a switch only the chip shows. */
function NowOverlay({ s, gameId }: { s: S; gameId: string }) {
  const game = gameById(gameId);
  if (game.shape === "live") return <NightChip />;
  const seats = seatViews(game, s.asleep, () => true);
  const left = s.left;
  return (
    <>
      {left && <NowBand gameId={gameId} kicker={left.undone ? "Back to" : "Now playing"} seats={seats} settle />}
      <NowChip gameId={gameId} seats={seats} delayed={!!left} />
    </>
  );
}
