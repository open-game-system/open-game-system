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

/** A live game night on this home's TV: the shared board is the game's; the console adds only
 * which seat is ours and whose turn it is, small, in the corner. */
export function NightChip() {
  const ours = HEARTHISLE.seats.find((x) => x.householdId === HOME.id);
  if (!ours) return null;
  const name = ours.label.split(" (")[0] ?? ours.label;
  return (
    <div className="ct-chip ct-chip--night">
      <i className="ct-chip__seat" style={{ background: ours.color }} />
      <b>{name}</b>
      <span>our seat</span>
      <span className="ct-chip__sep" />
      <span className="ct-chip__turn">{HEARTHISLE.turn ? `${HEARTHISLE.turn} to roll` : "Your turn"}</span>
    </div>
  );
}
