// Word Duel's page in the library: the same people, seen through one game. Start a new one here.
import { person } from "../../../world";
import type { Store } from "../../../harness/store";
import { go, type S } from "../state";
import { NavBar, StatusBar, TabBar } from "../ui/Chrome";
import { Patch } from "../ui/Patch";
import { IconPlus } from "../ui/Icons";
import { DuelRow, opponent, tabTo } from "./PeopleHome";

/** Grown-ups you could challenge. Kids in other homes are never suggested or shown. */
const SUGGEST = ["pop", "ada", "tunde"].map(person);

export function DuelsList({ s, store }: { s: S; store: Store<S> }) {
  const mine = s.duels.filter((d) => d.status === "yourTurn");
  const theirs = s.duels.filter((d) => d.status === "waiting");
  const done = s.duels.filter((d) => d.status === "completed" || d.status === "expired");
  return (
    <div className="pf-phone">
      <StatusBar />
      <NavBar onBack={() => store.update(go({ kind: "library" }))} title="Word Duel" sub={`${mine.length + theirs.length} going · a move whenever, over days`} />
      <div className="pf-scroll">
        <div className="pf-newgame">
          <p className="pf-newgame-title">New game with…</p>
          <div className="pf-newgame-row">
            {SUGGEST.map((p) => (
              <button key={p.id} className="pf-newgame-person" data-bot={`new-${p.id}`}>
                <Patch person={p} size={52} />
                <span>{p.name}</span>
              </button>
            ))}
            <button className="pf-newgame-person" data-bot="new-invite">
              <span className="pf-newgame-plus">
                <IconPlus />
              </span>
              <span>Invite</span>
            </button>
          </div>
        </div>
        <div className="pf-section">
          <span>Your move</span>
          <em>{mine.length}</em>
        </div>
        {mine.map((d) => (
          <DuelRow key={d.id} d={d} store={store} from="duels" />
        ))}
        <div className="pf-section">Their move</div>
        {theirs.map((d) => (
          <DuelRow key={d.id} d={d} store={store} from="duels" />
        ))}
        <div className="pf-section">Finished</div>
        <button className="pf-done" data-bot="finished">
          <span className="pf-stack">
            {done.map((d) => (
              <Patch key={d.id} person={opponent(d)} size={32} dim={d.status === "expired"} />
            ))}
          </span>
          <span>{done.map((d) => (d.status === "completed" ? `Won with ${d.opponent}` : `${d.opponent}'s closed after 14 days`)).join(" · ")}</span>
        </button>
        <div style={{ height: 20 }} />
      </div>
      <TabBar current="games" badge={mine.length} onTab={(t) => tabTo(store, t)} />
    </div>
  );
}
