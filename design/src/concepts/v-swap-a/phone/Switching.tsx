// The switch, as the phone (the hand) sees it, Shelf swap: the open box closes and the resume point
// is written on its spine; it goes back on the shelf; the next box comes down and opens; each
// person's sticker climbs into it as their device follows. Nobody scans, nobody picks a role.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { pointIn, savedAt, seatPlan, type S, type Switching as Sw } from "../state";
import { Spine, spineStyle } from "../shelf/Spine";
import { Portrait } from "../ui/Brand";
import { GameArt } from "../ui/GameArt";
import { Battery, Check, Moon, PhoneIcon, Spinner, TabletIcon } from "../ui/Icons";

const STEP = { saving: 0, cutover: 1, following: 2 };

export function Switching({ s, sw, asleep, store }: { s: S; sw: Sw; asleep: string[]; store: Store<S> }) {
  const from = gameById(sw.from);
  const to = gameById(sw.to);
  const step = STEP[sw.phase];
  const seats = seatPlan(to);
  const point = pointIn(s, from.id);
  return (
    <div className={`cx-switch psw psw--${sw.phase}`}>
      <h2 className="psw__title ogs-display">
        {step === 0 ? `Putting ${from.name} away` : step === 1 ? `${to.name} is out of the box` : "Everyone's climbing in"}
      </h2>
      <div className="psw__stage">
        <div className="psw__old">
          {step === 0 ? (
            <span className="psw__closing" style={spineStyle(from.id)} aria-hidden>
              <span className="psw__tray"><GameArt gameId={from.id} /></span>
              <span className="psw__lid"><GameArt gameId={from.id} alt /></span>
            </span>
          ) : (
            <Spine gameId={from.id} text={{ point, when: `saved ${savedAt(sw)}` }} className="sp--phone psw__shelved" tail={<span className="psw__ok"><Check size={18} /></span>} />
          )}
          <span className="psw__label">
            {step === 0 ? <Spinner size={16} /> : <Check size={16} />}
            {step === 0 ? `Writing ${point.toLowerCase()} on the spine` : "Back on the shelf"}
          </span>
        </div>
        <div className="psw__new" style={spineStyle(to.id)}>
          <span className="psw__tray"><GameArt gameId={to.id} /></span>
          <span className="psw__lid psw__lid--new" aria-hidden><GameArt gameId={to.id} alt /></span>
          <span className="psw__newname">
            <b>{to.name}</b>
            <span>{pointIn(s, to.id)} · Living room TV</span>
          </span>
        </div>
      </div>
      <ul className="cx-seats">
        {seats.map((x, i) => {
          const isPhone = x.device?.kind === "phone";
          const sleeping = !!x.device && asleep.includes(x.device.id);
          const ready = !sleeping && (step === 2 ? true : step === 1 ? isPhone : false);
          const battery = x.device?.battery ?? 1;
          return (
            <li key={x.person.id} className={ready ? "is-ready" : ""} style={{ animationDelay: `${i * 120}ms` }}>
              <Portrait person={x.person} size={40} />
              <span className="cx-seats__text">
                <b>
                  {x.person.name} · {x.role.label}
                </b>
                <span>
                  {isPhone ? <PhoneIcon size={14} /> : <TabletIcon size={14} />}
                  {sleeping && step === 2 ? "Asleep · seat waits in the box" : isPhone ? "This phone" : x.device?.name}
                  {battery < 0.15 && !(sleeping && step === 2) && (
                    <span className="cx-seats__low">
                      <Battery size={16} level={battery} /> {Math.round(battery * 100)}%
                    </span>
                  )}
                </span>
              </span>
              <span className="cx-seats__state">{ready ? <Check size={20} /> : sleeping && step === 2 ? <Moon size={20} /> : <Spinner size={20} />}</span>
            </li>
          );
        })}
      </ul>
      <button className="cx-btn cx-btn--ghost cx-switch__cancel" data-bot="switch-cancel" onClick={() => store.update((x) => ({ ...x, switching: null, onTv: sw.from }))}>
        <span>Leave {from.name} out</span>
      </button>
    </div>
  );
}
