// Stand-ins for Bake Shop's own controller pages (the game owns these; OGS only frames them).
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import type { S } from "../state";
import { Bell, Cream, Cupcake, Sprinkles, Strawberry } from "./icons";

const BS = gameById("bake-shop");
const bump = (store: Store<S>) => store.update((x) => ({ ...x, juice: x.juice + 1 }));

export function BakeReader({ store }: { store: Store<S> }) {
  return (
    <div className="ch-bs">
      <div className="ch-bs-day">
        <span>Day 4</span>
        <span className="ch-bs-pips" aria-label="3 of 5 orders baked">
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} className={i < 3 ? "is-done" : i === 3 ? "is-now" : ""} />
          ))}
        </span>
      </div>
      <div className="ch-bs-ticket">
        <img src={BS.art.extra?.bear} alt="" />
        <div>
          <small>Order 4 · Mrs. Bear</small>
          <p>"One strawberry cupcake, with lots and lots of sprinkles, please!"</p>
        </div>
      </div>
      <p className="ch-bs-hint">Read it out loud. Juneau bakes it, Ava does the sprinkles.</p>
      <div className="ch-bs-tray">
        <span className="is-in">
          <Cupcake size={60} layers={1} />
          Cake
        </span>
        <span>
          <Strawberry size={52} />
          Strawberry
        </span>
        <span>
          <Sprinkles size={52} />
          Sprinkles
        </span>
      </div>
      <button className="ch-bs-bell" data-bot="bs-bell" onClick={() => bump(store)}>
        <Bell size={30} />
        Ring the bell when it's ready
      </button>
    </div>
  );
}

export function BakeKid({ store, little, juice }: { store: Store<S>; little: boolean; juice: number }) {
  return (
    <div className="ch-bs ch-bs-kid">
      <div className="ch-bs-dream" aria-hidden="true">
        <Cupcake size={220} layers={4} />
      </div>
      <div className="ch-bs-build" aria-hidden="true">
        <Cupcake size={340} layers={1 + (juice % 4)} />
      </div>
      {little ? (
        <div className="ch-bs-helper">
          <img src={BS.art.extra?.bunny} alt="" className="ch-bs-bunny" />
          <button className="ch-bs-ing ch-bs-ing-big" data-bot="kid-tap" onClick={() => bump(store)} style={{ transform: `rotate(${(juice % 3) * 10 - 10}deg)` }}>
            <Sprinkles size={280} />
          </button>
        </div>
      ) : (
        <div className="ch-bs-ings">
          <button className="ch-bs-ing is-want" data-bot="kid-strawberry" onClick={() => bump(store)}>
            <Strawberry size={170} />
          </button>
          <button className="ch-bs-ing" data-bot="kid-cream" onClick={() => bump(store)}>
            <Cream size={170} />
          </button>
          <button className="ch-bs-ing" data-bot="kid-sprinkles" onClick={() => bump(store)}>
            <Sprinkles size={170} />
          </button>
        </div>
      )}
    </div>
  );
}
