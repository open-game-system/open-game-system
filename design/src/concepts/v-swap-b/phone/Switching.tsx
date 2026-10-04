// "Doorway", as the phone sees it: a small map of the TV's doorway (the same doorway in miniature,
// so what the grown-up sees here is what the room sees), then who's through and who's still on
// the way. Nobody scans, nobody picks a role.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { pointIn, type S, type Switching as Sw } from "../state";
import { doorSeats, TvDoor } from "../tv/TvDoor";
import { isThrough } from "../tv/door";
import type { SeatView } from "../tv/Roster";
import { Portrait } from "../ui/Brand";
import { Battery, Moon } from "../ui/Icons";

export function Switching({ s, sw, asleep, store }: { s: S; sw: Sw; asleep: string[]; store: Store<S> }) {
  const from = gameById(sw.from);
  const to = gameById(sw.to);
  const seats = doorSeats(sw.to, asleep, sw.phase);
  const through = seats.filter((x) => isThrough(x, sw.phase));
  const waiting = seats.filter((x) => !isThrough(x, sw.phase));
  const title =
    sw.phase === "saving"
      ? `Saving ${from.name}`
      : sw.phase === "cutover"
        ? `Through the door to ${to.name}`
        : waiting.length
          ? `In ${to.name}, one seat kept`
          : `Everyone's in ${to.name}`;
  const sub = sw.phase === "saving" ? `${pointIn(s, from.id)} · the door to ${to.name} is opening` : `${from.name} saved at ${pointIn(s, from.id).toLowerCase()} · ${to.name} ${pointIn(s, to.id).toLowerCase()}`;
  return (
    <div className={`dwm dwm--${sw.phase}`}>
      <div className="dwm__map" aria-label={`The TV: ${through.length} of ${seats.length} through the door`}>
        <TvDoor sw={sw} asleep={asleep} mini />
      </div>
      <h2 className="dwm__title">{title}</h2>
      <p className="dwm__sub">{sub}</p>
      <div className="dwm__sides">
        <Side title="Through" seats={through} inside />
        <Side title={sw.phase === "following" ? "Not yet" : "On the way"} seats={waiting} />
      </div>
      <button className="cx-btn cx-btn--ghost dwm__cancel" data-bot="switch-cancel" onClick={() => store.update((x) => ({ ...x, switching: null, onTv: sw.from }))}>
        <span>Stay on {from.name}</span>
      </button>
    </div>
  );
}

function Side({ title, seats, inside = false }: { title: string; seats: SeatView[]; inside?: boolean }) {
  return (
    <section className={`dwm__side ${inside ? "dwm__side--in" : ""}`}>
      <h3>{title}</h3>
      {seats.length === 0 ? (
        <p className="dwm__empty">{inside ? "The door is opening" : "Nobody"}</p>
      ) : (
        <ul>
          {seats.map((x, i) => (
            <li key={x.person.id} style={{ animationDelay: `${i * 120}ms` }}>
              <Portrait person={x.person} size={34} dim={x.state === "asleep"} />
              <span>
                {x.person.name}
                <small>
                  {x.state === "asleep" ? (
                    <>
                      <Moon size={12} /> Asleep · seat kept
                    </>
                  ) : inside ? (
                    x.role.label
                  ) : (
                    <>
                      {x.device?.name ?? x.role.label}
                      {(x.device?.battery ?? 1) < 0.15 && (
                        <>
                          {" "}
                          <Battery size={14} level={x.device?.battery ?? 0} /> {Math.round((x.device?.battery ?? 0) * 100)}%
                        </>
                      )}
                    </>
                  )}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
