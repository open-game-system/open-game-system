// Tonight's game night as one ambient line on the console home, and the corner chip while a night is
// live on our TV. Both read the night model (nights.ts), so a paused or new night shows truthfully.
import { gameById } from "../../../world";
import { nightLine, nightStatus, short, US, type Night } from "../nights";
import type { S } from "../state";
import { TvArt } from "./TvArt";

/** The night the console home should mention: a live one, else the next one with a time, else the latest. */
export function headlineNight(s: S): Night | undefined {
  const list = s.nights.list;
  return list.find((n) => n.status === "live") ?? list.find((n) => n.when) ?? list[0];
}

export function GameNightLine({ s }: { s: S }) {
  const n = headlineNight(s);
  if (!n) return null;
  const others = n.homes.filter((h) => h.householdId !== US).map((h) => short(h.name));
  return (
    <aside className="ct-night">
      <span className="ct-night__art">
        <TvArt gameId={n.gameId} />
      </span>
      <span className="ct-night__text">
        <span className="ct-night__when">{n.when ? `Game night ${n.when.replace(/^Tonight /, "")}` : nightStatus(n, s.onTv).label}</span>
        <span className="ct-night__line">
          <b>{gameById(n.gameId).name}</b> with {others.join(" and ")} · {nightLine(n).split(" · ")[0]}
        </span>
      </span>
    </aside>
  );
}

/** A live game night on this home's TV: the shared board is the game's; the console adds only
 * which seat is ours and whose turn it is, small, in the corner. */
export function NightChip({ s }: { s: S }) {
  const n = s.nights.list.find((x) => x.gameId === s.onTv) ?? headlineNight(s);
  const ours = n?.homes.find((h) => h.householdId === US);
  if (!n || !ours) return null;
  const turnHome = n.homes.find((h) => h.householdId === n.turnOf);
  return (
    <div className="ct-chip ct-chip--night">
      <i className="ct-chip__seat" style={{ background: ours.color }} />
      <b>{short(ours.name)}</b>
      <span>our seat</span>
      <span className="ct-chip__sep" />
      <span className="ct-chip__turn">{n.turnOf === US ? "Our roll" : `${short(turnHome?.name ?? "")} to roll`}</span>
    </div>
  );
}
