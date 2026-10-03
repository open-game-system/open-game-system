// Lane 3, "Game nights": games played across homes. Each night is its own card: the game's art,
// the homes in seat order on the follow path, where it stands, and when it's next.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { beginNewNight, nightLine, nightStatus, openNight, type Night } from "../nights";
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

export function NightsLane({ s, store }: { s: S; store: Store<S> }) {
  return (
    <Lane
      id="nights"
      title="Game nights"
      action={
        <button className="cx-lane__more" data-bot="night-new" onClick={() => store.update((x) => night(x, beginNewNight))}>
          <Plus size={16} /> New
        </button>
      }
    >
      <div className="cx-nights">
        {s.nights.list.map((n) => (
          <NightCard key={n.id} n={n} s={s} store={store} />
        ))}
      </div>
    </Lane>
  );
}
