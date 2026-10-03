// Word Duel: every open game, one per opponent, grouped by who has to move.
import type { Store } from "../../../harness/store";
import { HOUSEHOLDS, type DuelGame } from "../../../world";
import type { S } from "../state";
import { StatusBar } from "../ui/Brand";
import { Chevron, Plus } from "../ui/Icons";
import { ago } from "../ui/time";

function Row({ d, store }: { d: DuelGame; store: Store<S> }) {
  const lead = d.you - d.them;
  const open = () => store.update((x) => ({ ...x, phone: "duel", duel: { open: d.id, placed: [], result: null } }));
  const live = d.status === "yourTurn" || d.status === "waiting";
  return (
    <li className={`wd-row wd-row--${d.status}`}>
      <button className="wd-row__main" data-bot={`duel-${d.id}`} onClick={open} disabled={!live}>
        <span className="wd-row__bar" style={{ background: d.color }} />
        <span className="wd-row__text">
          <b>
            {d.opponent} <em>{d.opponentHome}</em>
          </b>
          <span>{d.lastMove}</span>
          <span className="wd-row__meta">
            {d.status === "expired" ? "Closed" : ago(d.updatedAt)} · You {d.you} · {d.opponent} {d.them}
            {live && lead !== 0 && <i className={lead > 0 ? "up" : "down"}>{lead > 0 ? ` · up ${lead}` : ` · down ${-lead}`}</i>}
          </span>
        </span>
        {d.status === "yourTurn" && (
          <span className="wd-row__go">
            Play <Chevron size={16} />
          </span>
        )}
      </button>
      {(d.status === "completed" || d.status === "expired") && (
        <button className="cx-btn cx-btn--sm cx-btn--ghost wd-row__rematch"><span>Rematch</span></button>
      )}
    </li>
  );
}

export function DuelList({ s, store }: { s: S; store: Store<S> }) {
  const mine = s.duels.filter((d) => d.status === "yourTurn");
  const theirs = s.duels.filter((d) => d.status === "waiting").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const done = s.duels.filter((d) => d.status === "completed" || d.status === "expired");
  return (
    <div className="wd">
      <StatusBar />
      <div className="wd-top">
        <button className="cx-back" data-bot="duels-home" onClick={() => store.update((x) => ({ ...x, phone: "home", tab: "home" }))}>
          <Chevron size={20} dir="left" /> Home
        </button>
        <button className="cx-btn cx-btn--sm cx-btn--ghost" data-bot="duel-new">
          <Plus size={18} /> <span>New game</span>
        </button>
      </div>
      <h1 className="wd-title">Word Duel</h1>
      {s.duels.length === 0 ? (
        <DuelEmpty />
      ) : (
        <div className="wd-groups">
          {mine.length > 0 ? (
            <section>
              <h2 className="wd-h">
                Your turn <span className="cx-count"><span>{mine.length}</span></span>
              </h2>
              <ul>{mine.map((d) => <Row key={d.id} d={d} store={store} />)}</ul>
            </section>
          ) : (
            <p className="wd-caught">You're all caught up. We'll tell you when someone moves.</p>
          )}
          <section>
            <h2 className="wd-h">Their turn</h2>
            <ul>{theirs.map((d) => <Row key={d.id} d={d} store={store} />)}</ul>
          </section>
          <section>
            <h2 className="wd-h">Finished</h2>
            <ul>{done.map((d) => <Row key={d.id} d={d} store={store} />)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}


function DuelEmpty() {
  const people = HOUSEHOLDS.flatMap((h) => h.people.filter((p) => p.band === "grownup" && p.id !== "dad").map((p) => ({ p, city: h.city })));
  return (
    <div className="wd-empty">
      <p className="wd-empty__lead">A word game you play a move at a time, over days. One game per person.</p>
      <h2 className="wd-h">Challenge someone you play with</h2>
      <ul className="wd-people">
        {people.map(({ p, city }) => (
          <li key={p.id}>
            <span className="wd-row__bar" style={{ background: p.color }} />
            <span className="wd-people__name">
              <b>{p.name}</b>
              <span>{city}</span>
            </span>
            <button className="cx-btn cx-btn--sm cx-btn--ghost"><span>Challenge</span></button>
          </li>
        ))}
      </ul>
      <button className="cx-btn cx-btn--primary wd-empty__link"><span>Invite by link</span></button>
    </div>
  );
}
