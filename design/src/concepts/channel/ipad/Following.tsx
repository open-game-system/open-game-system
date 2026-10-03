// Following the cut, told with art and motion only: the colour bars sweep (the same ident as the TV),
// then the kid's own portrait travels from the old game to the new one and lands in their seat.
import { HOME, type Person } from "../../../world";
import { segment } from "../programme";
import type { S } from "../state";

export function Following({ s, kid }: { s: S; kid: Person }) {
  const from = segment(s.prev ?? "rocket-crew");
  const to = segment(s.next);
  if (s.cut === "ident") {
    return (
      <div className="ch-ipad ch-fol-ident" style={{ "--kid": kid.color }}>
        <div className="ch-ident-bars ch-ident-bars-ipad" aria-hidden="true">
          {HOME.people.map((p, i) => (
            <i key={p.id} style={{ background: p.color, animationDelay: `${i * 110}ms` }} />
          ))}
        </div>
        <img className="ch-fol-me-center" src={kid.portrait} alt="" />
      </div>
    );
  }
  return (
    <div className="ch-ipad ch-fol" style={{ "--kid": kid.color }}>
      <div className="ch-fol-from" aria-hidden="true">
        <img src={from.game.art.tv} alt="" />
        <span className="ch-fol-check" />
      </div>
      <svg className="ch-fol-path" viewBox="0 0 820 1180" aria-hidden="true">
        <path d="M250 300 C 620 360, 640 560, 470 700" fill="none" stroke="var(--kid)" strokeWidth="10" strokeDasharray="2 26" strokeLinecap="round" />
      </svg>
      <div className="ch-fol-to" aria-hidden="true">
        <img src={to.game.art.tv} alt="" />
        <span className="ch-fol-seat" />
      </div>
      <img className="ch-fol-me" src={kid.portrait} alt="" />
    </div>
  );
}
