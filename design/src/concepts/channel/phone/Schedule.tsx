// Later: the schedule layer. Things that don't happen on the couch right now, filed by when.
import type { Store } from "../../../harness/store";
import { HOUSEHOLDS, WORLD_EVENTS, gameById } from "../../../world";
import { StationBar, StatusBar } from "../brand/PhoneTop";
import { hearthisle } from "../programme";
import { go, type S } from "../state";
import { DuelArt } from "../duel/Art";
import { TabBar } from "./TabBar";

export function Schedule({ s, store }: { s: S; store: Store<S> }) {
  const turns = s.duels.filter((d) => d.status === "yourTurn");
  const waiting = s.duels.filter((d) => d.status === "waiting").length;
  const sn = gameById("story-nook");
  const hi = gameById("hearthisle");
  const away = WORLD_EVENTS.filter((e) => e.kind === "moved-in");
  return (
    <div className="ch-phone">
      <StatusBar dark />
      <StationBar />
      <main className="ch-scroll">
        <div className="ch-page-head">
          <h1>Later</h1>
          <p>What isn't on the couch right now: other nights, other homes, your move.</p>
        </div>

        <h2 className="ch-guide-day">Tonight</h2>
        <ol className="ch-guide">
          <li>
            <time>7:45</time>
            <div className="ch-guide-item">
              <img src={sn.art.extra?.dragon} alt="" className="ch-guide-cut" />
              <b>Story Nook · bedtime</b>
              <small>Juneau's character is ready: Ember the dragon finished painting this morning.</small>
              <button className="ch-secondary" data-bot="add-story" onClick={() => store.update((x) => ({ ...x, next: "story-nook", phone: "director" }))}>
                Line it up after Bake Shop
              </button>
            </div>
          </li>
          <li>
            <time>8:00</time>
            <div className="ch-guide-item ch-guide-live">
              <img src={hi.art.tv} alt="" className="ch-guide-art" />
              <b>Hearthisle game night</b>
              <small>
                {hearthisle.title.replace("Game night · ", "Resumes at turn ")} · {hearthisle.turn} to roll · three homes
              </small>
              <ul className="ch-homes">
                {hearthisle.seats.map((seat) => {
                  const hh = HOUSEHOLDS.find((h) => h.id === seat.householdId);
                  return (
                    <li key={seat.householdId}>
                      <i style={{ background: seat.color }} />
                      <span>
                        <b>{seat.label}</b>
                        <small>{hh?.city}{seat.householdId === "hh-nana" ? " · on phones" : " · on their TV"}</small>
                      </span>
                      <em>{seat.score}</em>
                    </li>
                  );
                })}
              </ul>
              <p className="ch-trust">Each home sees only its own hands. Other homes see Juneau as "Juneau", nothing more.</p>
            </div>
          </li>
        </ol>

        <h2 className="ch-guide-day">Whenever</h2>
        <ol className="ch-guide">
          <li>
            <time className="is-turn">Your move</time>
            <button className="ch-guide-item ch-guide-btn" data-bot="open-duels" onClick={() => go(store, "duel-list")}>
              <DuelArt className="ch-guide-art" />
              <b>Word Duel · {turns.length} your turn</b>
              <small>
                {turns.map((d) => d.opponent).join(" and ")} · {waiting} waiting on them
              </small>
            </button>
          </li>
        </ol>

        <h2 className="ch-guide-day">While you were out</h2>
        <ol className="ch-guide">
          {away.map((e) => (
            <li key={e.id}>
              <time>Thu</time>
              <div className="ch-guide-item">
                <b>{gameById(e.gameId).name}</b>
                <small>{e.text}</small>
              </div>
            </li>
          ))}
        </ol>
      </main>
      <TabBar store={store} active="schedule" turns={turns.length} />
    </div>
  );
}
