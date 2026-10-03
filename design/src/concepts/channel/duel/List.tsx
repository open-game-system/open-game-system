// Your turn, across games: every async game where someone's waiting on you, then the rest.
import type { Store } from "../../../harness/store";
import type { DuelGame } from "../../../world";
import { StationBar, StatusBar } from "../brand/PhoneTop";
import { TabBar } from "../phone/TabBar";
import { go, type S } from "../state";
import { ago } from "./time";

const GROUPS: { id: DuelGame["status"]; label: string }[] = [
  { id: "yourTurn", label: "Your turn" },
  { id: "waiting", label: "Their turn" },
  { id: "completed", label: "Finished" },
  { id: "expired", label: "Closed" },
];

export function DuelList({ s, store }: { s: S; store: Store<S> }) {
  const turns = s.duels.filter((d) => d.status === "yourTurn").length;
  return (
    <div className="ch-phone ch-wd">
      <StatusBar dark />
      <StationBar />
      <main className="ch-scroll">
        <div className="ch-page-head ch-wd-head">
          <div>
            <h1>Your turn</h1>
            <p>Word Duel · one game per person, a move whenever</p>
          </div>
          <button className="ch-secondary ch-wd-new" data-bot="new-game" onClick={() => go(store, "duel-new")}>
            New game
          </button>
        </div>
        {GROUPS.map((g) => {
          const games = s.duels.filter((d) => d.status === g.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          if (games.length === 0) return null;
          return (
            <section key={g.id} className={`ch-wd-group is-${g.id}`}>
              <h2 className="ch-kicker ch-kicker-plain">
                {g.label} <span className="ch-count"><span>{games.length}</span></span>
              </h2>
              <ul>
                {games.map((d) => (
                  <li key={d.id}>
                    <DuelRow d={d} store={store} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
      <TabBar store={store} active="duel-list" turns={turns} />
    </div>
  );
}

function DuelRow({ d, store }: { d: DuelGame; store: Store<S> }) {
  const lead = d.you - d.them;
  const open = () => store.update((x) => ({ ...x, duelOpen: d.id, phone: "duel-board", placed: [], sent: false }));
  const yours = d.status === "yourTurn";
  const playable = yours || d.status === "waiting";
  return (
    <button className={`ch-wd-row${yours ? " is-turn" : ""}${playable ? "" : " is-done"}`} data-bot={`duel-${d.id}`} onClick={open}>
      <i className="ch-wd-swatch" style={{ background: d.color }} aria-hidden="true" />
      <span className="ch-wd-who">
        <b>{d.opponent}</b>
        <small>{d.opponentHome}</small>
      </span>
      <span className="ch-wd-move">
        <span>{d.lastMove}</span>
        <small>{ago(d.updatedAt)}</small>
      </span>
      <span className="ch-wd-score">
        <b>
          {d.you}–{d.them}
        </b>
        <small>{d.status === "completed" ? "won" : lead >= 0 ? `up ${lead}` : `down ${-lead}`}</small>
      </span>
      {yours && <span className="ch-wd-play"><span>Play</span></span>}
    </button>
  );
}
