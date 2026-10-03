// Tonight: the programme. On now (or coming up), up next, and what's later (another night, another home, your move).
import type { Store } from "../../../harness/store";
import { StationBar, StatusBar } from "../brand/PhoneTop";
import { Tally } from "../brand/Mark";
import { CHANNEL, seatsFor, segment, upNext } from "../programme";
import { cutTo, go, type S } from "../state";
import { SeatLine } from "./Seats";
import { TabBar } from "./TabBar";
import { LaterList } from "./LaterList";

export function Home({ s, store }: { s: S; store: Store<S> }) {
  const now = segment(s.onAir);
  const standby = s.tv === "continuity";
  const next = segment(upNext(s.onAir)[0] ?? "bake-shop");
  const turns = s.duels.filter((d) => d.status === "yourTurn").length;
  return (
    <div className="ch-phone">
      <StatusBar dark />
      <StationBar />
      <main className="ch-scroll">
        <section className="ch-block">
          <h2 className="ch-kicker">
            {standby ? <span className="ch-kicker-plain">Coming up · {CHANNEL.tv}</span> : <Tally label={`On now · ${CHANNEL.tv}`} />}
          </h2>
          <article className="ch-hero">
            <img src={now.game.art.tv} alt="" />
            <div className="ch-hero-lt">
              <span className="ch-hero-time">{standby ? "7:10" : `Since ${now.slot}`}</span>
              <h3>{now.game.name}</h3>
              <p><span>{now.instance.title}</span></p>
            </div>
          </article>
          <SeatLine seats={seatsFor(now.game)} />
          {standby ? (
            <button className="ch-primary" data-bot="start" onClick={() => cutTo(store, s.onAir)}>
              <span>Start {now.game.name}</span>
            </button>
          ) : (
            <button className="ch-primary" data-bot="controls" onClick={() => go(store, "controller")}>
              <span>Back to the controls</span>
            </button>
          )}
        </section>

        <section className="ch-block ch-block-rule">
          <h2 className="ch-kicker ch-kicker-plain">Up next</h2>
          <button className="ch-row" data-bot="up-next" onClick={() => store.update((x) => ({ ...x, next: next.game.id, phone: "director" }))}>
            <span className="ch-row-time">~{next.slot}</span>
            <img className="ch-row-art" src={next.game.art.tv} alt="" />
            <span className="ch-row-body">
              <b>{next.game.name}</b>
              <small>{next.instance.title.split(" · ")[0]} · picks up where you paused</small>
            </span>
            <i className="ch-chev" aria-hidden="true" />
          </button>
        </section>

        <LaterList store={store} compact />
      </main>
      <TabBar store={store} active="home" turns={turns} />
    </div>
  );
}
