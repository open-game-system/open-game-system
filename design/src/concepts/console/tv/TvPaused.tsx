// The TV while the console menu is open on the phone: the game steps back into a paused card,
// the ring mark pulses, and the next couch games come up. The phone chooses; the TV only shows.
import { GAMES, gameById } from "../../../world";
import { nextLine, resumeDetail, resumePoint, seatPlan } from "../state";
import { Portrait } from "../ui/Brand";
import { PhoneIcon } from "../ui/Icons";
import { Clock, FollowPath, PulseMark } from "./Motif";
import { TvArt } from "./TvArt";

export function TvPaused({ gameId }: { gameId: string }) {
  const g = gameById(gameId);
  const next = GAMES.filter((x) => x.shape === "couch" && x.id !== gameId);
  return (
    <div className="ct-paused">
      <header className="ct-top">
        <span className="ct-brand">
          <PulseMark size={52} />
          <span>Living room · paused</span>
        </span>
        <Clock />
      </header>
      <span className="ct-paused__badge">
        <PauseGlyph />
        Paused · {resumePoint(gameId)}
      </span>
      <section className="ct-paused__info">
        <span className="ct-kicker">On hold</span>
        <h2>{g.name}</h2>
        <p className="ct-paused__line">{resumeDetail(gameId) || resumePoint(gameId)}</p>
        <p className="ct-paused__note">Switching saves it. Back to it any time tonight.</p>
        <div className="ct-paused__who">
          {seatPlan(g).map((x) => (
            <Portrait key={x.person.id} person={x.person} size={52} />
          ))}
        </div>
      </section>
      <div className="ct-paused__hint">
        <PhoneIcon size={34} />
        Choose on Jonathan's phone
      </div>
      <FollowPath className="ct-paused__path" w={360} h={150} d="M330 10 C 300 90, 160 60, 40 140" />
      <section className="ct-paused__shelf" aria-label="Up next">
        <span className="ct-kicker">Up next</span>
        <ul>
          {next.map((x, i) => (
            <li key={x.id} style={{ animationDelay: `${120 + i * 60}ms` }}>
              <span className="ct-paused__tile">
                <TvArt gameId={x.id} />
              </span>
              <b>{x.name}</b>
              <span>{nextLine(x.id).split(" · ")[0]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PauseGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="4" width="5" height="16" rx="1.6" fill="currentColor" />
      <rect x="14" y="4" width="5" height="16" rx="1.6" fill="currentColor" />
    </svg>
  );
}
