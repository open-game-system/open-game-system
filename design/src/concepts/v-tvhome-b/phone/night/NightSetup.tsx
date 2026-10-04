// Steps 2 and 3 of a new game night: seats (a seat is a person or a whole household) and where
// each home plays (its own TV, or phones only).
import type { Store } from "../../../../harness/store";
import { toStep, toggleSplit, US, type Night } from "../../nights";
import { startNightS, type S } from "../../state";
import { HomesPath } from "../../ui/HomesPath";
import { HomeRows } from "./HomeRows";

export function NightSeats({ n, store }: { n: Night; s: S; store: Store<S> }) {
  const us = n.homes.find((h) => h.householdId === US);
  const split = us?.seat === "split";
  return (
    <div className="cx-setup2">
      <h1 className="cx-title">Seats</h1>
      <p className="cx-lede">A seat is one person or a whole home. Each seat keeps its own hand; the board is shared.</p>
      <HomesPath night={n} />
      <HomeRows n={n} store={store} mode="seat" />
      <label className="cx-switchrow cx-switchrow--card">
        <span>
          <b>Juneau gets his own seat</b>
          <span>{split ? "Two Mumm seats: blue and green. Others see “Mumms” twice." : "Juneau and you share blue: he rolls, you place."}</span>
        </span>
        <input type="checkbox" role="switch" data-bot="seat-split" checked={split} onChange={() => store.update((x) => ({ ...x, nights: toggleSplit(x.nights) }))} />
      </label>
      <div className="cx-dock">
        <button className="cx-btn cx-btn--light cx-wide" data-bot="seats-next" onClick={() => store.update((x) => ({ ...x, nights: toStep(x.nights, "where") }))}>
          <span>Next: where each home plays</span>
        </button>
      </div>
    </div>
  );
}

export function NightWhere({ n, store }: { n: Night; store: Store<S> }) {
  const phonesOnly = n.homes.filter((h) => h.screen === "phones").map((h) => h.name);
  return (
    <div className="cx-setup2">
      <h1 className="cx-title">Where each home plays</h1>
      <p className="cx-lede">Every home sees the same board on its own screen, and only its own hands.</p>
      <HomeRows n={n} store={store} mode="screen" />
      {phonesOnly.length > 0 && <p className="cx-keeps">{phonesOnly.join(" and ")} have no TV, so the board comes to their phones. Nothing to set up.</p>}
      <div className="cx-dock">
        <button className="cx-btn cx-btn--light cx-wide" data-bot="night-start" onClick={() => store.update(startNightS)}>
          <span>Start on the living room TV</span>
        </button>
      </div>
    </div>
  );
}
