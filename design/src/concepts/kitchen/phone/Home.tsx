// Tonight: the household first (who's on the couch, on which device), then what the TV is doing,
// then the noticeboard (everything that happened or waits between sittings), then the shelf.
import type { Store } from "../../../harness/store";
import { HEARTHISLE, WORLD_EVENTS, gameById } from "../../../world";
import { PlaceCard } from "../ui/PlaceCard";
import { DeviceLine, Section, StatusBar, Wordmark } from "../ui/Bits";
import { Swap } from "../ui/Icons";
import { people, saveOf, seatsFor } from "../household";
import { Noticeboard } from "./Noticeboard";
import { Shelf } from "./Shelf";
import { Switcher } from "./Switcher";
import type { S } from "../state";

export function Home({ s, store }: { s: S; store: Store<S> }) {
  return (
    <div className="pl pl-phone">
      <StatusBar time={s.clock} />
      <div className="pl-scroll">
        <header className="pl-home-head">
          <div>
            <Wordmark />
            <h1 className="pl-h1">
              The Mumms <span className="pl-h1-when">Friday {s.clock} pm</span>
            </h1>
          </div>
          <button className="pl-btn pl-btn--quiet" data-bot="family" onClick={() => store.update((x) => ({ ...x, phone: "family" }))}>
            <span> Family</span>
          </button>
        </header>

        <Section title="On the couch tonight" className="pl-section--couch">
          <div className="pl-couch">
            {people.map((p, i) => (
              <PlaceCard key={p.id} person={p} line={<DeviceLine personId={p.id} />} delay={i * 60} />
            ))}
          </div>
        </Section>

        <TvCard s={s} store={store} />
        <Noticeboard store={store} events={WORLD_EVENTS} hearthisle={HEARTHISLE} />
        <Shelf />
      </div>
      {s.sheet === "switcher" && <Switcher s={s} store={store} />}
    </div>
  );
}

function TvCard({ s, store }: { s: S; store: Store<S> }) {
  const t = s.tonight;
  const gameId = t.kind === "playing" ? t.gameId : "rocket-crew";
  const game = gameById(gameId);
  const inst = saveOf(gameId);
  const playing = t.kind === "playing";
  const seats = seatsFor(game);
  return (
    <section className="pl-tvcard">
      <div className="pl-tvcard-over">
        <span className={`pl-live${playing ? "" : " pl-live--off"}`} />
        <span>{playing ? "On the living room TV" : "Living room TV · connected"}</span>
      </div>
      <div className="pl-tvcard-art">
        <img src={game.art.tv} alt="" />
      </div>
      <div className="pl-tvcard-body">
        <h3 className="pl-h3">{playing ? game.name : `Pick up ${game.name}?`}</h3>
        <p className="pl-tvcard-detail">
          {inst?.title} · {playing ? "2 of 3 stars so far" : "saved Wednesday"}
        </p>
        <p className="pl-tvcard-seats">
          {seats.map((x, i) => (
            <span key={x.person.id}>
              {i > 0 && <span className="pl-dot">·</span>}
              <b>{x.person.name}</b> {x.role}
            </span>
          ))}
        </p>
        <div className="pl-row">
          {playing ? (
            <button className="pl-btn pl-btn--primary pl-grow" data-bot="open-game" onClick={() => store.update((x) => ({ ...x, phone: "game" }))}>
              <span> Back to the game</span>
            </button>
          ) : (
            <button
              className="pl-btn pl-btn--primary pl-grow"
              data-bot="play-on-tv"
              onClick={() => store.update((x) => ({ ...x, phone: "game", tonight: { kind: "playing", gameId } }))}
            >
              <span>Play on the TV</span>
            </button>
          )}
          <button className="pl-btn pl-btn--secondary" data-bot="switch-game" onClick={() => store.update((x) => ({ ...x, sheet: "switcher" }))}>
            <span>
              {" "}
              <Swap size={18} /> {playing ? "Switch" : "Other"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
