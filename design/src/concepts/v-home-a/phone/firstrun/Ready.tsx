// First run, done: the living room as one picture (TV, the people, their iPads), then Home.
import type { Store } from "../../../../harness/store";
import { finishSetup, setupPeople, type S } from "../../state";
import { Check, TabletIcon, TvIcon } from "../../ui/Icons";
import { Sticker } from "../../ui/Sticker";
import { SetupPath } from "./parts";

export function Ready({ s, store }: { s: S; store: Store<S> }) {
  const people = setupPeople(s.setup);
  const tv = s.setup.tv === "connected";
  return (
    <div className="fr">
      <div className="cx-scroll fr-scroll">
        <div className="cx-topbar" />
        <SetupPath step="ready" />
        <h1 className="cx-title">The living room is ready</h1>
        <p className="cx-lede">Each night, tick who's on the couch and press Play on TV. Their iPads join by name.</p>
        <div className="fr-room">
          <div className="fr-room__tv">
            <TvIcon size={40} />
            <span>{tv ? "Living room TV" : "No TV yet: phones only"}</span>
          </div>
          <span className="ogs-path-v fr-room__line" aria-hidden />
          <ul className="fr-room__people">
            {people.map((p) => {
              const ipad = s.setup.ipads[p.id];
              return (
                <li key={p.id}>
                  <Sticker person={p} size={60} />
                  <b>{p.name}</b>
                  <span>
                    {p.band === "grownup" ? "Phone" : ipad === "paired" ? <><TabletIcon size={14} /> iPad</> : "Plays along"}
                    {ipad === "paired" && <Check size={14} />}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="cx-dock fr-dock">
        <button className="cx-btn cx-btn--light cx-wide" data-bot="setup-finish" onClick={() => store.update(finishSetup)}>
          <span>Go to Home</span>
        </button>
      </div>
    </div>
  );
}
