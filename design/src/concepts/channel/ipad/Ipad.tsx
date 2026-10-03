// A kid's iPad is paired once ("this is Juneau's") and follows tonight. No words, ever.
// It shows who it belongs to (their portrait, their colour), and the game it's following.
import type { Store } from "../../../harness/store";
import { personById } from "../programme";
import type { S } from "../state";
import { KidController } from "../games/registry";
import { Idle } from "./Idle";
import { Following } from "./Following";
import { Asleep } from "./Asleep";
import { Hold } from "./Hold";

export function Ipad({ s, store }: { s: S; store: Store<S> }) {
  const kid = personById(s.ipad);
  if (!kid) return null;
  const little = kid.band === "little";
  if (s.ipad === "ava" && s.avaAsleep && (s.cut === "following" || (s.cut === null && s.prev !== null))) return <Asleep />;
  if (s.tv !== "segment") return <Idle s={s} store={store} kid={kid} />;
  if (s.cut === "saving") return <Hold s={s} kid={kid} />;
  if (s.cut === "ident" || s.cut === "following") return <Following s={s} kid={kid} />;
  return (
    <div className="ch-ipad" style={{ "--kid": kid.color }}>
      <KidController gameId={s.onAir} store={store} little={little} juice={s.juice} />
      <span className="ch-ipad-owner" aria-hidden="true">
        <img src={kid.portrait} alt="" />
      </span>
    </div>
  );
}
