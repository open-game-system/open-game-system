// "Now playing": the console's one sentence after a cut (title, resume point, who's in), and the
// small corner chip it settles into so the game owns the TV again.
import { gameById } from "../../../world";
import { resumeDetail, resumePoint } from "../state";
import { Mark, Portrait } from "../ui/Brand";
import { Roster, type SeatView } from "./Roster";

export function NowBand({ gameId, kicker, seats, settle, stagger = 0 }: { gameId: string; kicker: string; seats: SeatView[]; settle: boolean; stagger?: number }) {
  const g = gameById(gameId);
  const detail = resumeDetail(gameId);
  return (
    <div className={`ct-band ${settle ? "ct-band--settle" : ""}`}>
      <div className="ct-band__scrim" />
      <section className="ct-band__title">
        <span className="ct-kicker">{kicker}</span>
        <h1>{g.name}</h1>
        <p>
          {resumePoint(gameId)}
          {detail ? ` · ${detail}` : ""}
        </p>
      </section>
      <Roster seats={seats} stagger={stagger} />
    </div>
  );
}

export function NowChip({ gameId, seats, delayed }: { gameId: string; seats: SeatView[]; delayed: boolean }) {
  const g = gameById(gameId);
  return (
    <div className={`ct-chip ${delayed ? "ct-chip--after" : ""}`}>
      <Mark size={34} />
      <b>{g.name}</b>
      <span>{resumePoint(gameId)}</span>
      <span className="ct-chip__who">
        {seats.map((x) => (
          <Portrait key={x.person.id} person={x.person} size={40} dim={x.state === "asleep"} />
        ))}
      </span>
    </div>
  );
}
