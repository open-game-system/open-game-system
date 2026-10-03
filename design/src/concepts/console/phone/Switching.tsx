// The switch, as the phone sees it: the old game saves, the TV cuts over, each paired device
// follows by name. Nobody scans, nobody picks a role.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { resumePoint, seatPlan, type S, type Switching as Sw } from "../state";
import { Portrait } from "../ui/Brand";
import { GameArt } from "../ui/GameArt";
import { Battery, Check, Moon, PhoneIcon, Spinner, TabletIcon } from "../ui/Icons";

const STEP = { saving: 0, cutover: 1, following: 2 };

export function Switching({ sw, asleep, store }: { sw: Sw; asleep: string[]; store: Store<S> }) {
  const from = gameById(sw.from);
  const to = gameById(sw.to);
  const step = STEP[sw.phase];
  const seats = seatPlan(to);
  return (
    <div className={`cx-switch cx-switch--${sw.phase}`}>
      <div className="cx-switch__cards">
        <div className="cx-switch__from">
          <GameArt gameId={from.id} alt />
          <span className="cx-switch__saved">
            {step === 0 ? <Spinner size={16} /> : <Check size={16} />}
            {step === 0 ? "Saving" : `Saved · ${resumePoint(from.id)}`}
          </span>
        </div>
        <div className="cx-switch__arrow" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="cx-switch__to">
          <GameArt gameId={to.id} alt />
        </div>
      </div>
      <h2 className="cx-switch__title">
        {step === 0 ? `Saving ${from.name}, ${resumePoint(from.id).toLowerCase()}` : step === 1 ? `${to.name} is coming up on the TV` : "Everyone's moving over"}
      </h2>
      <p className="cx-switch__sub">
        {to.name} · {resumePoint(to.id)} · Living room TV
      </p>
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
                  {isPhone ? "This phone" : x.device?.name}
                  {battery < 0.15 && (
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
        <span>Stay on {from.name}</span>
      </button>
    </div>
  );
}
