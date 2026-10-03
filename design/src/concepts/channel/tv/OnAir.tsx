import { pickup, point, segment, seatsFor } from "../programme";
import type { S } from "../state";
import { Bug } from "./Bug";
import { Bars } from "../brand/Mark";

export function OnAir({ s }: { s: S }) {
  const seg = segment(s.onAir);
  const following = s.cut === "following";
  const lt = following || s.lowerThird;
  const seats = seatsFor(seg.game);
  return (
    <div className={`ch-tv ch-onair${following ? " is-arriving" : ""}`}>
      <img className="ch-onair-art" src={seg.game.art.tv} alt="" />
      {!lt && <Bug />}
      {lt && (
        <div className="ch-lt" key={`${s.onAir}-${s.lowerThird ?? "f"}`}>
          <div className="ch-lt-tab">
            <Bars height={26} width={7} gap={3} />
            <span>{s.lowerThird === "back" ? "Back on" : "Now"}</span>
          </div>
          <div className="ch-lt-main">
            <b>{seg.game.name}</b>
            <span>{s.lowerThird === "back" ? `Right where you left it · ${point(seg)}` : `${point(seg)} · ${pickup(seg)}`}</span>
          </div>
          <ul className="ch-lt-seats">
            {seats.map((x) => {
              const asleep = x.person.id === "ava" && s.avaAsleep;
              const inSeat = !following && !asleep;
              return (
                <li key={x.person.id} className={asleep ? "is-asleep" : inSeat ? "is-in" : "is-coming"}>
                  <i style={{ borderColor: x.person.color, background: inSeat ? x.person.color : "transparent" }} />
                  {x.person.name}
                  {asleep && <em> · iPad asleep, seat saved</em>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
