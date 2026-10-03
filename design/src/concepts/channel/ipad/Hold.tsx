// The game is being saved: the controller shrinks into a little TV and holds still. Taps do nothing.
import type { Person } from "../../../world";
import { segment } from "../programme";
import type { S } from "../state";

export function Hold({ s, kid }: { s: S; kid: Person }) {
  const from = segment(s.prev ?? s.onAir);
  return (
    <div className="ch-ipad ch-hold" style={{ "--kid": kid.color }}>
      <div className="ch-hold-tile" aria-hidden="true">
        <img src={from.game.art.tv} alt="" />
        <span className="ch-hold-pause">
          <i />
          <i />
        </span>
      </div>
      <img className="ch-hold-me" src={kid.portrait} alt="" />
    </div>
  );
}
