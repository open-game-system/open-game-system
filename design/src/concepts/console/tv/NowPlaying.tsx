// "Now playing": the console's one line after a cut (title, resume point, who's in) as a strip along
// the bottom edge, never in the game's focal area, and the small corner chip it collapses into
// within ~2 s so the game owns the TV again.
import { gameById } from "../../../world";
import { detailIn, pointIn, type S } from "../state";
import { Mark, Portrait } from "../ui/Brand";
import { Roster, type SeatView } from "./Roster";

export function NowBand({ s, gameId, kicker, seats, settle, stagger = 0 }: { s: S; gameId: string; kicker: string; seats: SeatView[]; settle: boolean; stagger?: number }) {
  const g = gameById(gameId);
  const detail = detailIn(s, gameId);
  return (
    <div className={`ct-band ${settle ? "ct-band--settle" : ""}`}>
      <div className="ct-band__scrim" />
      <div className="ct-band__row">
        <section className="ct-band__title">
          <span className="ct-kicker">{kicker}</span>
          <h1>{g.name}</h1>
          <p>
            {pointIn(s, gameId)}
            {detail ? ` · ${detail}` : ""}
          </p>
        </section>
        <Roster seats={seats} stagger={stagger} />
      </div>
    </div>
  );
}

export function NowChip({ s, gameId, seats, delayed }: { s: S; gameId: string; seats: SeatView[]; delayed: boolean }) {
  const g = gameById(gameId);
  return (
    <div className={`ct-chip ${delayed ? "ct-chip--after" : ""}`}>
      <Mark size={34} />
      <b>{g.name}</b>
      <span>{pointIn(s, gameId)}</span>
      <span className="ct-chip__who">
        {seats.map((x) => (
          <Portrait key={x.person.id} person={x.person} size={40} dim={x.state === "asleep"} />
        ))}
      </span>
    </div>
  );
}
