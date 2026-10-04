// Variant "Instant + receipt": on the TV the switch is a cut, ~1 s end to end.
//   saving    — the old game freezes for a beat and flashes (0.2 s): the save happened.
//   cutover   — the next game wipes across the whole screen (0.4 s), full frame, no cards.
//   following — the people pop into the corner chip as their devices land; the receipt stamp
//               lands in the top-left corner. Then the game simply plays (TvPlaying keeps both).
// Nothing ever sits in the middle of the screen.
import { gameById } from "../../../world";
import { GameTvView } from "../games/registry";
import type { S, Switching } from "../state";
import { NowChip } from "./NowPlaying";
import { Stamp } from "./Stamp";
import { seatViews } from "./Roster";

export function TvCutover({ s, sw, asleep }: { s: S; sw: Switching; asleep: string[] }) {
  const to = gameById(sw.to);
  const seats = seatViews(to, asleep, (x) => sw.phase === "following" || (sw.phase === "cutover" && x.device?.kind === "phone"));
  return (
    <div className={`ct-snap ct-snap--${sw.phase}`}>
      <div className="ct-snap__from" aria-hidden>
        <GameTvView gameId={sw.from} />
      </div>
      {sw.phase !== "saving" && (
        <div className="ct-snap__to">
          <GameTvView gameId={sw.to} />
        </div>
      )}
      <i className="ct-snap__flash" aria-hidden />
      {sw.phase !== "saving" && <Stamp s={s} gameId={sw.from} />}
      {sw.phase !== "saving" && <NowChip s={s} gameId={sw.to} seats={seats} delayed={false} pop />}
    </div>
  );
}
