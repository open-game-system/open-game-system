// New game: one duel per person, so people you already play are shown as "game on", not offered twice.
import type { Store } from "../../../harness/store";
import { StatusBar } from "../brand/PhoneTop";
import { go, type S } from "../state";

const PEOPLE = [
  { name: "Pop", home: "Boise", color: "#5a6b7d", game: null },
  { name: "Ada", home: "Seattle", color: "#d14d72", game: "wd-6" },
  { name: "Marcus", home: "Chicago", color: "#1f6f8b", game: "wd-7" },
] as const;

export function NewGame({ s, store }: { s: S; store: Store<S> }) {
  const active = s.duels.filter((d) => d.status === "yourTurn" || d.status === "waiting");
  return (
    <div className="ch-phone ch-wd">
      <StatusBar dark />
      <header className="ch-wd-bar">
        <button className="ch-ghost" data-bot="back-list" onClick={() => go(store, "duel-list")}>
          <i className="ch-ico ch-ico-back" aria-hidden="true" />
          Your turn
        </button>
        <span className="ch-wd-title">New game</span>
      </header>
      <main className="ch-scroll">
        <div className="ch-page-head">
          <h1>Who's it with?</h1>
          <p>One Word Duel per person. They get a nudge on their phone; kids' devices never do.</p>
        </div>
        <ul className="ch-pick">
          {PEOPLE.map((p) => {
            const old = p.game ? s.duels.find((d) => d.id === p.game) : undefined;
            return (
              <li key={p.name}>
                <i style={{ background: p.color }} aria-hidden="true" />
                <span>
                  <b>{p.name}</b>
                  <small>{p.home}{old ? ` · ${old.status === "completed" ? "last game: you won" : "last game closed"}` : ""}</small>
                </span>
                <button className="ch-secondary" data-bot={`invite-${p.name.toLowerCase()}`}>
                  {old ? "Rematch" : "Start"}
                </button>
              </li>
            );
          })}
        </ul>
        <h2 className="ch-kicker ch-kicker-plain ch-pad">Game on already</h2>
        <ul className="ch-pick is-muted">
          {active.map((d) => (
            <li key={d.id}>
              <i style={{ background: d.color }} aria-hidden="true" />
              <span>
                <b>{d.opponent}</b>
                <small>{d.status === "yourTurn" ? "your move" : "their move"}</small>
              </span>
            </li>
          ))}
        </ul>
      </main>
      <footer className="ch-dock">
        <button className="ch-primary" data-bot="invite-link">
          <span>Invite someone new with a link</span>
        </button>
      </footer>
    </div>
  );
}
