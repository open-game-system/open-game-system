// Tonight's first game: the living room TV connects, the game comes up, and each paired device on
// the couch joins its seat by name, down the follow path.
import { gameById } from "../../../world";
import { hereTonight, seatPlan, type S } from "../state";
import { Portrait } from "../ui/Brand";
import { GameArt } from "../ui/GameArt";
import { Check, PhoneIcon, Spinner, TabletIcon, TvIcon } from "../ui/Icons";

export function Casting({ s, gameId }: { s: S; gameId: string }) {
  const g = gameById(gameId);
  const seats = seatPlan(g, hereTonight(s));
  return (
    <div className="cx-switch cx-switch--cutover">
      <div className="cx-switch__cards">
        <div className="cx-cast__tv">
          <TvIcon size={40} />
          <span>Living room TV</span>
        </div>
        <div className="cx-switch__arrow" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="cx-switch__to">
          <GameArt gameId={g.id} alt />
        </div>
      </div>
      <h2 className="cx-switch__title">{g.name} is coming up on the TV</h2>
      <p className="cx-switch__sub">Connecting once. After tonight's first game, switching is instant.</p>
      <ul className="cx-seats">
        {seats.map((x, i) => {
          const isPhone = x.device?.kind === "phone";
          return (
            <li key={x.person.id} className={isPhone ? "is-ready" : ""} style={{ animationDelay: `${i * 120}ms` }}>
              <Portrait person={x.person} size={40} />
              <span className="cx-seats__text">
                <b>
                  {x.person.name} · {x.role.label}
                </b>
                <span>
                  {isPhone ? <PhoneIcon size={14} /> : <TabletIcon size={14} />}
                  {isPhone ? "This phone" : `${x.device?.name ?? "Their iPad"} · joining by name`}
                </span>
              </span>
              <span className="cx-seats__state">{isPhone ? <Check size={20} /> : <Spinner size={20} />}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
