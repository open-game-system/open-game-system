// Tonight's seats for a game, as the TV shows them: who, which role, and whether their device has
// arrived. A seat whose device is asleep shows the sleeping state (its seat is kept), never a check.
import type { GameManifest } from "../../../world";
import { seatPlan, type SeatAssign } from "../state";
import { Portrait } from "../ui/Brand";
import { Check, Moon, PhoneIcon, TabletIcon } from "../ui/Icons";

export type SeatState = "ready" | "waiting" | "asleep";

export interface SeatView extends SeatAssign {
  state: SeatState;
}

/** Seat states for a game. `arrived` decides which awake devices are in already. */
export function seatViews(game: GameManifest, asleep: string[], arrived: (x: SeatAssign) => boolean): SeatView[] {
  return seatPlan(game).map((x) => {
    const sleeping = !!x.device && asleep.includes(x.device.id);
    return { ...x, state: sleeping ? "asleep" : arrived(x) ? "ready" : "waiting" };
  });
}

export function Roster({ seats, stagger = 0 }: { seats: SeatView[]; stagger?: number }) {
  return (
    <ul className="ct-roster">
      {seats.map((x, i) => (
        <li key={x.person.id} className={`is-${x.state}`} style={{ animationDelay: `${i * stagger}ms` }}>
          <Portrait person={x.person} size={68} dim={x.state !== "ready"} />
          <span>
            <b>{x.person.name}</b>
            <em>{x.state === "asleep" ? "Asleep · seat kept" : x.role.label}</em>
          </span>
          <i style={{ animationDelay: `${i * stagger}ms` }}>
            <SeatIcon x={x} />
          </i>
        </li>
      ))}
    </ul>
  );
}

function SeatIcon({ x }: { x: SeatView }) {
  if (x.state === "ready") return <Check size={32} />;
  if (x.state === "asleep") return <Moon size={30} />;
  return x.device?.kind === "phone" ? <PhoneIcon size={30} /> : <TabletIcon size={30} />;
}
