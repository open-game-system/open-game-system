// Lane 3, "Game nights": games played across homes. Each night is its own card: the game's art,
// the homes in seat order on the follow path, where it stands, and when it's next.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { beginNewNight, nightLine, nightStatus, openNight, type Night } from "../nights";
import { comingUp } from "../inbox";
import { night, type S } from "../state";
import { Chip } from "../ui/Chip";
import { GameArt } from "../ui/GameArt";
import { HomesPath } from "../ui/HomesPath";
import { Lane } from "../ui/Lane";
import { Plus } from "../ui/Icons";

export function NightCard({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  return (
    <button className="cx-nightcard" data-bot={`night-${n.id}`} onClick={() => store.update((x) => night(x, (ns) => openNight(ns, n.id)))}>
      <span className="cx-nightcard__art">
        <GameArt gameId={n.gameId} alt={n.id !== "hi-1"} />
      </span>
      <span className="cx-nightcard__top">
        <Chip status={nightStatus(n, s.onTv)} />
      </span>
      <span className="cx-nightcard__body">
        <span className="cx-nightcard__title">
          <b>{gameById(n.gameId).name}</b>
          <span>{nightLine(n)}</span>
        </span>
        <HomesPath night={n} />
      </span>
    </button>
  );
}

/** Lane 3, "Coming up": game nights with a time set (and new ones waiting on replies). A night
 * whose turn it is sits in Your turn instead, and one on our TV is the TV lane's: never twice. */
export function NightsLane({ s, store }: { s: S; store: Store<S> }) {
  const ids = comingUp(s).map((t) => (t.target.kind === "night" ? t.target.id : ""));
  const list = s.nights.list.filter((n) => ids.includes(n.id));
  return (
    <Lane
      id="nights"
      title="Coming up"
      action={
        <button className="cx-lane__more" data-bot="night-new" onClick={() => store.update((x) => night(x, beginNewNight))}>
          <Plus size={16} /> Game night
        </button>
      }
    >
      {list.length === 0 && <p className="cx-lane__empty">No game nights set. Start one with the homes you play with.</p>}
      <div className="cx-nights">
        {list.map((n) => (
          <NightCard key={n.id} n={n} s={s} store={store} />
        ))}
      </div>
    </Lane>
  );
}
