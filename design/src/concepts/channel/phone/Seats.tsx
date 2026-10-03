// Who sits where in a segment: the person, their role, and the device that's theirs. Never a picker.
import type { Seat } from "../programme";

export function SeatLine({ seats, asleep = [] }: { seats: Seat[]; asleep?: string[] }) {
  return (
    <ul className="ch-seats">
      {seats.map((s) => (
        <li key={s.person.id} className={asleep.includes(s.person.id) ? "is-asleep" : ""}>
          <i style={{ background: s.person.color }} aria-hidden="true" />
          <span>
            <b>{s.person.name}</b>
            <small>
              {s.role} · {s.device}
            </small>
          </span>
        </li>
      ))}
    </ul>
  );
}
