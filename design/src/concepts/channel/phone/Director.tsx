// The director's running order: what's on, what's next, and one button that cuts to it.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { Tally } from "../brand/Mark";
import { StatusBar } from "../brand/PhoneTop";
import { ALSO, CHANNEL, RUNNING_ORDER, seatsFor, segment } from "../programme";
import { cutTo, go, type S } from "../state";
import { SeatLine } from "./Seats";

export function Director({ s, store }: { s: S; store: Store<S> }) {
  const now = segment(s.onAir);
  const next = segment(s.next);
  const rest = [...RUNNING_ORDER, ...ALSO].filter((g) => g !== s.onAir && g !== s.next);
  const minutesIn = 8;
  return (
    <div className="ch-phone ch-director">
      <StatusBar dark />
      <header className="ch-dir-head">
        <button className="ch-ghost" data-bot="close-director" onClick={() => go(store, s.tv === "segment" ? "controller" : "home")}>
          <i className="ch-ico ch-ico-down" aria-hidden="true" />
          Back to {now.game.name}
        </button>
        <h1>Running order</h1>
        <p>{CHANNEL.tv} · Fri 3 Oct</p>
      </header>
      <main className="ch-scroll ch-rundown">
        <div className="ch-rd-row is-now">
          <span className="ch-rd-time">{now.slot}</span>
          <div className="ch-rd-body">
            <Tally />
            <b>{now.game.name}</b>
            <small>
              {now.instance.title} · {minutesIn} min in. Cutting away saves it right here.
            </small>
          </div>
        </div>
        <div className="ch-rd-row is-next">
          <span className="ch-rd-time">Next</span>
          <div className="ch-rd-body">
            <img className="ch-rd-art" src={next.game.art.tv} alt="" />
            <b>{next.game.name}</b>
            <small>
              {next.instance.title} · {next.instance.detail.replace(/^Paused [^·]+· /, "picks up where ")}
            </small>
            <SeatLine seats={seatsFor(next.game)} />
            <p className="ch-rd-note">Everyone's iPad goes straight to their seat. No codes, no picking.</p>
          </div>
        </div>
        <h2 className="ch-kicker ch-kicker-plain ch-rd-or">Or cut to</h2>
        {rest.map((id) => {
          const g = gameById(id);
          return (
            <button key={id} className="ch-row" data-bot={`pick-${id}`} onClick={() => store.update((x) => ({ ...x, next: id }))}>
              <span className="ch-row-time">{segment(id).slot}</span>
              <img className="ch-row-art" src={g.art.tv} alt="" />
              <span className="ch-row-body">
                <b>{g.name}</b>
                <small>{segment(id).instance.title}</small>
              </span>
            </button>
          );
        })}
      </main>
      <footer className="ch-dock">
        <button className="ch-primary ch-primary-cut" data-bot="cut" onClick={() => cutTo(store, s.next)}>
          <span className="ch-cut-ico" aria-hidden="true" />
          <span>Cut to {next.game.name}</span>
        </button>
      </footer>
    </div>
  );
}
