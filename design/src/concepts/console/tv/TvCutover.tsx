// The TV during a switch. This is the console's own screen (no game is running), so it may speak:
// the old game folds into a saved card, the new one opens out of its card, and each seat lights up
// as its device arrives. Everything sits in the lower third and left edge.
import { gameById } from "../../../world";
import { resumePoint, resumeDetail, seatPlan, type Switching } from "../state";
import { Mark, Portrait } from "../ui/Brand";
import { GameArt } from "../ui/GameArt";
import { Check, Moon, PhoneIcon, TabletIcon } from "../ui/Icons";

export function TvCutover({ sw, asleep }: { sw: Switching; asleep: string[] }) {
  const from = gameById(sw.from);
  const to = gameById(sw.to);
  const seats = seatPlan(to);
  return (
    <div className={`tv-cut tv-cut--${sw.phase}`}>
      <div className="tv-cut__to">
        <GameArt gameId={to.id} />
      </div>
      <div className="tv-cut__shade" />
      <div className="tv-cut__from">
        <GameArt gameId={from.id} />
        <span className="tv-cut__saved">
          <Check size={30} />
          Saved · {resumePoint(from.id)}
        </span>
      </div>
      <div className="tv-cut__mark">
        <Mark size={44} />
      </div>
      <section className="tv-cut__title">
        <span className="tv-kicker">{sw.undo ? "Back to" : sw.phase === "saving" ? "Up next" : "Now playing"}</span>
        <h1>{to.name}</h1>
        <p>
          {resumePoint(to.id)}
          {resumeDetail(to.id) ? ` · ${resumeDetail(to.id)}` : ""}
        </p>
      </section>
      <ul className="tv-cut__seats">
        {seats.map((x, i) => {
          const sleeping = !!x.device && asleep.includes(x.device.id);
          const isPhone = x.device?.kind === "phone";
          const ready = !sleeping && (sw.phase === "following" || (sw.phase === "cutover" && isPhone));
          return (
            <li key={x.person.id} className={ready ? "is-ready" : sleeping ? "is-asleep" : ""} style={{ animationDelay: `${200 + i * 160}ms` }}>
              <Portrait person={x.person} size={64} dim={!ready} />
              <span>
                <b>{x.person.name}</b>
                <em>{x.role.label}</em>
              </span>
              <i>{ready ? <Check size={30} /> : sleeping ? <Moon size={28} /> : isPhone ? <PhoneIcon size={28} /> : <TabletIcon size={28} />}</i>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
