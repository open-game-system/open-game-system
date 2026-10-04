// Waiting on you: duels and game nights collapse into one strip at the foot of the remote. Each
// token is whoever (or whatever night) is waiting: their sticker on a lamp-lit disc for a move that
// is yours, the game's art for a night with a time set. One tap opens it; "All" opens every game.
import { useStore, type Store } from "../../../../harness/store";
import { gameById } from "../../../../world";
import { everyGame, type TurnItem } from "../../inbox";
import { night, type S } from "../../state";
import { beginNewNight } from "../../nights";
import { GameArt } from "../../ui/GameArt";
import { Chevron, Plus } from "../../ui/Icons";
import { Sticker } from "../../ui/Sticker";
import { opponentOf } from "../../wordduel/Opponent";
import { openTurn } from "../TurnRows";

function who(t: TurnItem, s: S): { name: string; what: string; sticker: { id: string; sticker: string } | null } {
  const d = t.duel ? s.duels.find((x) => x.id === t.duel) : undefined;
  if (d) {
    const p = opponentOf(d);
    return { name: d.opponent, what: d.lastWord ?? "Word Duel", sticker: { id: p?.id ?? d.id, sticker: p?.sticker ?? d.sticker } };
  }
  const n = t.target.kind === "night" ? s.nights.list.find((x) => x.id === (t.target.kind === "night" ? t.target.id : "")) : undefined;
  const when = n?.when?.replace(/^Tonight /, "") ?? "";
  return { name: gameById(t.gameId).name, what: t.status.kind === "yours" ? "Your roll" : when || t.status.label, sticker: null };
}

export function WaitingStrip({ s, store }: { s: S; store: Store<S> }) {
  const live = useStore(store);
  const all = everyGame(s);
  const yours = all.yours;
  const coming = all.coming;
  const tokens = [...yours, ...coming].slice(0, 3);
  const others = all.theirs.length;
  const landed = live.arrival?.phase === "landed" ? `turn-${live.arrival.id}` : null;
  return (
    <section className="rm-wait" aria-label="Waiting on you">
      <header className="rm-wait__head">
        <h2 className="rm-h">
          {yours.length > 0 ? "Waiting on you" : "Nobody's waiting on you"}
          {yours.length > 0 && (
            <span key={yours.length} className="rm-wait__count">
              {yours.length}
            </span>
          )}
        </h2>
        <button className="rm-wait__all" data-bot="inbox-all" aria-label={`All games with turns${others ? `, ${others} waiting on others` : ""}`} onClick={() => store.update((x) => ({ ...x, phone: "inbox" }))}>
          All <Chevron size={16} />
        </button>
      </header>
      <ul className="rm-wait__tokens">
        {tokens.map((t) => {
          const w = who(t, s);
          const mine = t.status.kind === "yours";
          return (
            <li key={t.id} className={t.id === landed ? "is-arriving" : ""}>
              <button className={`rm-token ${mine ? "is-yours" : "is-coming"}`} data-bot={t.id} aria-label={`${t.title}. ${t.detail}`} onClick={() => store.update((x) => openTurn(x, t.target))}>
                <span className="rm-token__disc">{w.sticker ? <Sticker person={w.sticker} size={44} /> : <GameArt gameId={t.gameId} alt />}</span>
                <b>{w.name}</b>
                <span>{w.what}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button className="rm-token is-new" data-bot="night-new" aria-label="Start a new game night with other homes" onClick={() => store.update((x) => night(x, beginNewNight))}>
            <span className="rm-token__disc">
              <Plus size={24} />
            </span>
            <b>Game night</b>
            <span>New</span>
          </button>
        </li>
      </ul>
    </section>
  );
}
