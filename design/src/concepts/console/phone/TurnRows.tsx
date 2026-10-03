// Rows of the "Your turn" inbox: one row per game waiting on you, whatever the game. Art leads;
// the chip says the status in the shared vocabulary.
import type { Store } from "../../../harness/store";
import type { TurnItem } from "../inbox";
import { openNight } from "../nights";
import { night, openDuel, type S } from "../state";
import { Chip } from "../ui/Chip";
import { DuelArt, GameArt } from "../ui/GameArt";
import { Chevron } from "../ui/Icons";

export const openTurn = (s: S, t: TurnItem["target"]): S => (t.kind === "duel" ? openDuel(s, t.id) : night({ ...s, push: null }, (n) => openNight(n, t.id)));

export function TurnRow({ item, store }: { item: TurnItem; store: Store<S> }) {
  return (
    <li>
      <button className="cx-row" data-bot={item.id} onClick={() => store.update((x) => openTurn(x, item.target))}>
        <span className="cx-row__art">{item.gameId === "word-duel" ? <DuelArt /> : <GameArt gameId={item.gameId} alt />}</span>
        <span className="cx-row__text">
          <b>{item.title}</b>
          <span>{item.detail}</span>
        </span>
        {item.status.kind === "yours" ? <Chevron size={18} /> : <Chip status={item.status} />}
      </button>
    </li>
  );
}

export function TurnRows({ items, store }: { items: TurnItem[]; store: Store<S> }) {
  if (items.length === 0) return <p className="cx-lane__empty">Nobody is waiting on you. We'll tell you when someone moves.</p>;
  return (
    <ul className="cx-rows">
      {items.map((t) => (
        <TurnRow key={t.id} item={t} store={store} />
      ))}
    </ul>
  );
}
