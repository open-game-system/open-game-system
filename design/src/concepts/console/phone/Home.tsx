// Phone home: the console in your pocket. Now playing → Your turn (across games) → Jump back in.
import type { Store } from "../../../harness/store";
import { HOME, gameById } from "../../../world";
import { activities } from "../activities";
import type { S } from "../state";
import { Portrait, Wordmark } from "../ui/Brand";
import { DuelArt, GameArt } from "../ui/GameArt";
import { Chevron } from "../ui/Icons";
import { ago } from "../ui/time";
import { NowPlaying } from "./NowPlaying";

export function HomeHeader() {
  return (
    <header className="cx-head">
      <Wordmark size={22} />
      <button className="cx-household" aria-label="The Mumms household">
        <span className="cx-household__faces">
          {HOME.people.map((p) => (
            <Portrait key={p.id} person={p} size={24} ring={false} />
          ))}
        </span>
        The Mumms
      </button>
    </header>
  );
}

export function Home({ s, store }: { s: S; store: Store<S> }) {
  const turns = s.duels.filter((d) => d.status === "yourTurn");
  const acts = activities(s);
  return (
    <div className="cx-scroll">
      <HomeHeader />
      <NowPlaying gameId={s.onTv} onOpen={() => store.update((x) => ({ ...x, phone: "controller" }))} />

      <section className="cx-sec">
        <h2 className="cx-h2">
          Your turn <span className="cx-count"><span>{turns.length}</span></span>
        </h2>
        <div className="cx-turns">
          {turns.map((d) => (
            <button
              key={d.id}
              className="cx-turn"
              data-bot={`turn-${d.id}`}
              onClick={() => store.update((x) => ({ ...x, phone: "duel", duel: { open: d.id, placed: [], result: null } }))}
            >
              <span className="cx-turn__art">
                <DuelArt />
              </span>
              <span className="cx-turn__text">
                <b>{d.lastMove}</b>
                <span>
                  Word Duel · {ago(d.updatedAt)}
                </span>
              </span>
              <span className="cx-turn__go">
                Play <Chevron size={16} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="cx-sec">
        <h2 className="cx-h2">Jump back in</h2>
        <div className="cx-acts cx-acts--grid">
          {acts.map((a) => (
            <article key={a.id} className="cx-act">
              <div className="cx-act__art">
                <GameArt gameId={a.gameId} alt />
                {a.badge && <span className={`cx-badge cx-badge--${a.badgeTone}`}>{a.badge}</span>}
              </div>
              <div className="cx-act__plate">
                <span className="cx-act__game">{gameNameOf(a.gameId)}</span>
                <b>{a.title}</b>
                <span>{a.detail}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const gameNameOf = (id: string) => gameById(id).name;
