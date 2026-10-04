// Rows of the "Your turn" inbox: one row per game waiting on you, whatever the game. Art leads;
// the chip says the status in the shared vocabulary.
import { useStore, type Store } from "../../../harness/store";
import type { TurnItem, TurnTarget } from "../inbox";
import { openNight } from "../nights";
import { night, openDuel, type S } from "../state";
import { Chip } from "../ui/Chip";
import { GameArt } from "../ui/GameArt";
import { DuelFace } from "../wordduel/Opponent";
import { Chevron } from "../ui/Icons";

export function openTurn(s: S, t: TurnTarget): S {
  if (t.kind === "duel") return openDuel(s, t.id);
  if (t.kind === "duels") return { ...s, phone: "duels", push: null };
  return night({ ...s, push: null }, (n) => openNight(n, t.id));
}

export function TurnRow({ item, store, duels }: { item: TurnItem; store: Store<S>; duels: S["duels"] }) {
  const d = item.duel ? duels.find((x) => x.id === item.duel) : undefined;
  return (
    <li>
      <button className="cx-row" data-bot={item.id} onClick={() => store.update((x) => openTurn(x, item.target))}>
        <span className={`cx-row__art ${d ? "cx-row__art--duel" : ""}`}>{d ? <DuelFace d={d} size={52} /> : <GameArt gameId={item.gameId} alt />}</span>
        <span className="cx-row__text">
          <b>{item.title}</b>
          <span>{item.detail}</span>
        </span>
        {item.status.kind === "yours" ? <Chevron size={18} /> : <Chip status={item.status} />}
      </button>
    </li>
  );
}

export function TurnRows({ items, store, empty, quiet = false }: { items: TurnItem[]; store: Store<S>; empty?: string; quiet?: boolean }) {
  const duels = useStore(store).duels;
  if (items.length === 0) return <p className="cx-lane__empty">{empty ?? "Nobody is waiting on you. We'll tell you when someone moves."}</p>;
  return (
    <ul className={`cx-rows ${quiet ? "cx-rows--quiet" : ""}`}>
      {items.map((t) => (
        <TurnRow key={t.id} item={t} store={store} duels={duels} />
      ))}
    </ul>
  );
}
