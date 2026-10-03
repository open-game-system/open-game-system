// A kid's iPad: paired once, follows tonight's game by itself. No words anywhere, nothing to leave.
import { person } from "../../../world";
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import { frost, poke, type S } from "../state";
import { KID_VIEW } from "../games";
import { Patch } from "../ui/Patch";
import { KidIdle } from "./KidIdle";
import { KidFollowing } from "./KidFollowing";
import { KidAsleep } from "./KidAsleep";

export function IpadSurface({ store }: { store: Store<S> }) {
  const s = useStore(store);
  const kid = person(s.ipadOwner);
  const c = s.couch;
  const onPoke = () => store.update(poke);
  if (s.ipadOwner === "ava" && c.avaAsleep) return <div className="pf pf-kid"><KidAsleep kid={kid} ringing={!!c.ringing} /></div>;
  if (!c.gameId) return <div className="pf pf-kid"><KidIdle kid={kid} pokes={c.pokes} onPoke={onPoke} /></div>;
  const swapping = c.phase === "saving" || c.phase === "cutover" || (c.phase === "following" && !c.arrived.includes(kid.id));
  if (swapping) return <div className="pf pf-kid"><KidFollowing kid={kid} from={c.left?.gameId} to={c.gameId} stage={c.phase === "saving" ? "leaving" : "going"} /></div>;
  const view = KID_VIEW[c.gameId];
  return (
    <div className="pf pf-kid" key={c.gameId}>
      <div className="pf-kid-game">
        {view?.({ frosting: c.frosting, pokes: c.pokes, little: kid.band === "little", onPoke, onFrost: (f) => store.update(frost(f)) })}
      </div>
      <span className="pf-kid-badge">
        <Patch person={kid} size={92} />
      </span>
    </div>
  );
}
