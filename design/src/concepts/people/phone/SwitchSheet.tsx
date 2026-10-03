// "Next on the couch": the household's own games, each with where it picks up and who sits where.
// One tap swaps. Everyone comes along; the game we leave is saved first (and can be undone).
import { COUCH, gameById } from "../../../world";
import type { Store } from "../../../harness/store";
import { closeSwitcher, go, pickGame, type S } from "../state";
import { Patch } from "../ui/Patch";
import { pickUp, seatFor } from "../ui/seats";
import { ON_COUCH } from "./PeopleHome";

export function SwitchSheet({ s, store }: { s: S; store: Store<S> }) {
  const current = s.couch.gameId ? gameById(s.couch.gameId) : undefined;
  const options = COUCH.filter((i) => i.gameId !== s.couch.gameId).sort((a, b) => (a.status === "suspended" ? -1 : b.status === "suspended" ? 1 : 0));
  return (
    <>
      <div className="pf-scrim" onClick={() => store.update(closeSwitcher)} />
      <div className="pf-sheet" role="dialog" aria-label="Next on the couch">
        <div className="pf-grabber" />
        <h2>Next on the couch</h2>
        <p className="pf-sheet-sub">{current ? `${current.name} saves where you are. Everyone's iPad comes along.` : "Everyone's iPad comes along."}</p>
        <div className="pf-scroll" style={{ flex: "0 1 auto" }}>
          {options.map((i) => {
            const g = gameById(i.gameId);
            return (
              <button key={i.id} className="pf-pick" data-bot={`pick-${g.id}`} onClick={() => store.update(pickGame(g.id))}>
                <img src={g.art.tv} alt="" />
                <span className="pf-pick-main">
                  <span className="pf-pick-name">{g.name}</span>
                  <span className={`pf-pick-at${i.status === "suspended" ? " resume" : ""}`}>{i.status === "suspended" ? `Resume · ${pickUp(g.id)}` : i.title}</span>
                  <span className="pf-pick-seats">
                    {ON_COUCH.map((p) => (
                      <span key={p.id} className="pf-pick-seat">
                        <Patch person={p} size={20} />
                        {seatFor(g.id, p)}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "12px 20px 0" }}>
          <button className="pf-secondary" style={{ flex: 1 }} data-bot="keep-playing" onClick={() => store.update(closeSwitcher)}>
            Keep playing
          </button>
          <button className="pf-secondary" style={{ flex: 1 }} data-bot="browse-games" onClick={() => store.update(go({ kind: "library" }))}>
            Something new
          </button>
        </div>
      </div>
    </>
  );
}
