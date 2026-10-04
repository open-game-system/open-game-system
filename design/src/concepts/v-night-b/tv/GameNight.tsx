// Tonight's game night as one ambient line on the console home, and the corner chip while a night is
// live on our TV. Both read the night model (nights.ts), so a paused or new night shows truthfully.
import { HOUSEHOLDS, gameById } from "../../../world";
import { Crest } from "../ui/Sticker";
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

/** A live game night on this home's TV: the shared board is the game's; the console adds only which
 * seat is ours (our crest, ringed in our seat colour) and whose turn it is, small, in the corner. When
 * the turn comes round to us, a short "our roll" moment drops in along the top edge (never on the board). */
export function NightChip({ s }: { s: S }) {
  const n = s.nights.list.find((x) => x.gameId === s.onTv) ?? headlineNight(s);
  const ours = n?.homes.find((h) => h.householdId === US);
  const home = HOUSEHOLDS.find((h) => h.id === US);
  if (!n || !ours || !home) return null;
  const turnHome = n.homes.find((h) => h.householdId === n.turnOf);
  const ourRoll = n.turnOf === US && n.status === "live";
  return (
    <>
      {ourRoll && (
        <div className="ct-turn" key={`${n.id}:${n.turn}`}>
          <span className="ct-turn__crest" style={{ boxShadow: `0 0 0 5px ${ours.color}` }}>
            <Crest household={home} size={62} />
          </span>
          <span className="ct-turn__text">
            <b>Our roll</b>
            <span>Turn {n.turn} · {seatLine(ours.seat)}</span>
          </span>
        </div>
      )}
      <div className={`ct-chip ct-chip--night ${ourRoll ? "is-ours" : ""}`}>
        <span className="ct-chip__crest" style={{ boxShadow: `0 0 0 4px ${ours.color}` }}>
          <Crest household={home} size={50} />
        </span>
        <b>{short(ours.name)}</b>
        <span>our place</span>
        <span className="ct-chip__sep" />
        <span className="ct-chip__turn">{ourRoll ? "Our roll" : `${short(turnHome?.name ?? "")} to roll`}</span>
      </div>
    </>
  );
}

const seatLine = (seat: string): string => (seat === "together" ? "Jonathan and Juneau, together" : "Jonathan, then Juneau");
