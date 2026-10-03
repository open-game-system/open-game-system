// Tonight's game night as one ambient line on the console home. It is not a couch game, so it never
// sits in the couch shelf: it is something the evening is heading toward.
import { HEARTHISLE, HOME, gameById } from "../../../world";
import { TvArt } from "./TvArt";

export function GameNightLine() {
  const others = HEARTHISLE.seats.filter((x) => x.householdId !== HOME.id).map((x) => x.label);
  return (
    <aside className="ct-night">
      <span className="ct-night__art">
        <TvArt gameId={HEARTHISLE.gameId} />
      </span>
      <span className="ct-night__text">
        <span className="ct-night__when">Game night 8:00</span>
        <b>{gameById(HEARTHISLE.gameId).name}</b>
        <span>with the {others.join(", ")}</span>
      </span>
    </aside>
  );
}
