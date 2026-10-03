// The cut: the household's colour bars sweep across, the channel says its name, the next segment opens.
import { HOME } from "../../../world";
import { segment } from "../programme";
import type { S } from "../state";

export function Ident({ s }: { s: S }) {
  const to = segment(s.next);
  return (
    <div className="ch-tv ch-ident">
      <img className="ch-ident-art" src={to.game.art.tv} alt="" />
      <div className="ch-ident-bars" aria-hidden="true">
        {HOME.people.map((p, i) => (
          <i key={p.id} style={{ background: p.color, animationDelay: `${i * 110}ms` }} />
        ))}
      </div>
      <div className="ch-ident-plate">
        <span className="ch-ident-ch">Channel Mumm</span>
        <span className="ch-ident-now">Now</span>
        <b>{to.game.name}</b>
      </div>
    </div>
  );
}
