// Paired and following tonight: "this is mine, and the TV is where it's happening". No words.
import type { Store } from "../../../harness/store";
import type { Person } from "../../../world";
import { Bars } from "../brand/Mark";
import { segment } from "../programme";
import type { S } from "../state";

export function Idle({ s, store, kid }: { s: S; store: Store<S>; kid: Person }) {
  const up = segment(s.onAir);
  return (
    <div className="ch-ipad ch-idle" style={{ "--kid": kid.color }}>
      <div className="ch-idle-top" aria-hidden="true">
        <Bars height={34} width={10} gap={5} live />
      </div>
      <div className="ch-idle-tv" aria-hidden="true">
        <img src={up.game.art.extra?.launch ?? up.game.art.tv} alt="" />
        <i className="ch-idle-tally" />
      </div>
      <div className="ch-idle-link" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} style={{ "--i": i }} />
        ))}
      </div>
      <button className="ch-idle-me" data-bot="kid-me" onClick={() => store.update((x) => ({ ...x, juice: x.juice + 1 }))} style={{ transform: `rotate(${(s.juice % 3) * 6 - 6}deg)` }}>
        <img src={kid.portrait} alt="" />
      </button>
    </div>
  );
}
