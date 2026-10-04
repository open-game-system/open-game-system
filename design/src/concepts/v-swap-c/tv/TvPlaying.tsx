// A game on the TV. The game owns every pixel; the console only steps in when the phone's console
// button is pressed (the game pauses back into a card) and, right after a switch, with a short
// "now playing" that settles into a corner chip.
import { gameById } from "../../../world";
import { GameTvView } from "../games/registry";
import type { S } from "../state";
import { NightChip } from "./GameNight";
import { NowBand, NowChip } from "./NowPlaying";
import { seatViews } from "./Roster";
import { Stamp } from "./Stamp";
import { TvPaused } from "./TvPaused";

export function TvPlaying({ s, gameId, arrived = false }: { s: S; gameId: string; arrived?: boolean }) {
  // Variant "Instant + receipt": the game keeps its full frame through the menu and after a cut
  // (no zooms, no bands); the menu only dims it, and the receipt stamp sits in the corner.
  return (
    <div className={`ct-play ${s.menu ? "is-paused ct-play--hold" : ""} ${s.left ? "ct-play--after" : ""}`}>
      <div className="ct-play__game">
        <div className="ct-play__zoom">
          <GameTvView gameId={gameId} />
        </div>
      </div>
      {s.menu ? <TvPaused s={s} gameId={gameId} /> : <NowOverlay s={s} gameId={gameId} arrived={arrived} />}
    </div>
  );
}

/** Right after a switch the band holds for a beat, then settles into the corner chip (CSS timeline;
 * shots freeze at its end, the settled frame). Without a switch only the chip shows. */
function NowOverlay({ s, gameId, arrived }: { s: S; gameId: string; arrived: boolean }) {
  const game = gameById(gameId);
  if (game.shape === "live") return <NightChip s={s} />;
  const seats = seatViews(game, s.asleep, () => true);
  const left = s.left;
  return (
    <>
      {arrived && !left && <NowBand s={s} gameId={gameId} kicker="Now playing" seats={seats} settle />}
      {left && <Stamp s={s} gameId={left.gameId} />}
      <NowChip s={s} gameId={gameId} seats={seats} delayed={arrived && !left} />
    </>
  );
}
