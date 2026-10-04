// Steps 2 and 3 of a new game night, on the drawn table: set the places (a place is one person or a
// whole home) and see where each place plays (its own TV, or phones only).
import type { Store } from "../../../../harness/store";
import { toStep, toggleSplit, US, type Night } from "../../nights";
import { startNightS, type S } from "../../state";
import { Table } from "./Table";

export function NightSeats({ n, store }: { n: Night; s: S; store: Store<S> }) {
  const us = n.homes.find((h) => h.householdId === US);
  const split = us?.seat === "split";
  return (
    <div className="iv-page">
      <h1 className="iv-title">Set the table</h1>
      <p className="iv-lede">A place is one person or a whole home. Each place holds its own hand; the board is shared.</p>
      <Table n={n} mode="seat" />
      <label className="iv-switch iv-switch--dark">
        <span>
          <b>Juneau gets his own place</b>
          <span>{split ? "Two Mumm places, blue and green. Other homes see the Mumms twice." : "Juneau shares blue with you: he rolls, you build."}</span>
        </span>
        <input type="checkbox" role="switch" data-bot="seat-split" checked={split} onChange={() => store.update((x) => ({ ...x, nights: toggleSplit(x.nights) }))} />
      </label>
      <div className="iv-dock">
        <button className="cx-btn iv-btn iv-wide" data-bot="seats-next" onClick={() => store.update((x) => ({ ...x, nights: toStep(x.nights, "where") }))}>
          <span>Next: where each home plays</span>
        </button>
      </div>
    </div>
  );
}

export function NightWhere({ n, store }: { n: Night; store: Store<S> }) {
  const phonesOnly = n.homes.filter((h) => h.screen === "phones").map((h) => h.name);
  return (
    <div className="iv-page">
      <h1 className="iv-title">Where each home plays</h1>
      <p className="iv-lede">Every home sees the same board on its own screen, and only its own hand.{phonesOnly.length > 0 ? ` ${phonesOnly.join(" and ")} have no TV, so the board comes to their phones.` : ""}</p>
      <Table n={n} mode="screen" />
      <div className="iv-dock">
        <button className="cx-btn iv-btn iv-wide" data-bot="night-start" onClick={() => store.update(startNightS)}>
          <span>Start on the living room TV</span>
        </button>
      </div>
    </div>
  );
}
