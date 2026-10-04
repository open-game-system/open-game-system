// The TV's receipt after a switch: a small stamp in the top-left corner, "Rocket Crew saved ·
// Mission 6", with the old game's art as a thumbnail. It stays put, small, out of the game's focal
// area, until the next switch; Back on the phone reverses it.
import { gameById } from "../../../world";
import { pointIn, type S } from "../state";
import { Check } from "../ui/Icons";
import { TvArt } from "./TvArt";

export function Stamp({ s, gameId }: { s: S; gameId: string }) {
  return (
    <div className="ct-stamp" role="status">
      <span className="ct-stamp__thumb" aria-hidden>
        <TvArt gameId={gameId} />
        <i>
          <Check size={22} />
        </i>
      </span>
      <span className="ct-stamp__text">
        <b>{gameById(gameId).name} saved</b>
        <span>{pointIn(s, gameId)}</span>
      </span>
    </div>
  );
}
