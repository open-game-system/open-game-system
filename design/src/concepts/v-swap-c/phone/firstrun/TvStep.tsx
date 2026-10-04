// First run, stop 1: find and connect the living room TV. Searching → found → connecting →
// connected; or nothing found, which hands over to the failure layer's "no TV" help (flow 9).
import { useEffect } from "react";
import type { Store } from "../../../../harness/store";
import { HOME } from "../../../../world";
import { fault } from "../../edge/fault";
import { setupPatch, type S } from "../../state";
import { Check, Spinner, TvIcon } from "../../ui/Icons";
import { StepFrame } from "./parts";

/** The prototype's stand-in for the network: a TV turns up a beat after searching starts. */
function useTvClock(s: S, store: Store<S>, shot: boolean) {
  const tv = s.setup.step === "tv" ? s.setup.tv : null;
  useEffect(() => {
    if (shot || (tv !== "searching" && tv !== "connecting")) return;
    const t = setTimeout(() => store.update((x) => setupPatch(x, { tv: tv === "searching" ? "found" : "connected" })), tv === "searching" ? 1600 : 1400);
    return () => clearTimeout(t);
  }, [tv, shot, store]);
}

function Found({ s, store }: { s: S; store: Store<S> }) {
  const tvs = HOME.devices.filter((d) => d.kind === "tv");
  const tv = s.setup.tv;
  return (
    <ul className="cx-homes fr-list">
      {tvs.map((d) => {
        const living = d.id === "dev-living-tv";
        return (
          <li key={d.id} className="cx-homes__row fr-row">
            <span className="fr-row__icon"><TvIcon size={24} /></span>
            <span className="cx-homes__text">
              <b>{d.name}</b>
              <span>{d.online ? "Chromecast · on this Wi-Fi" : "Off · turn it on to use it"}</span>
            </span>
            {living && tv === "found" && (
              <button className="cx-btn cx-btn--light cx-btn--sm" data-bot="connect-living" onClick={() => store.update((x) => setupPatch(x, { tv: "connecting" }))}>
                <span>Connect</span>
              </button>
            )}
            {living && tv === "connecting" && <span className="fr-row__state"><Spinner size={20} /> Connecting</span>}
            {living && tv === "connected" && <span className="fr-row__state fr-row__state--ok"><Check size={20} /> Connected</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function TvStep({ s, store, shot }: { s: S; store: Store<S>; shot: boolean }) {
  useTvClock(s, store, shot);
  const tv = s.setup.tv;
  if (tv === "missing") {
    return (
      <StepFrame
        s={s}
        store={store}
        back="welcome"
        title="No TV on this Wi-Fi yet"
        lede="We looked for a Chromecast or a TV with casting on the same Wi-Fi as this phone and didn't find one."
        dock={
          <div className="fr-dock__two">
            <button className="cx-btn cx-btn--light cx-wide" data-bot="setup-no-tv" onClick={() => store.update((x) => ({ ...x, fault: fault("no-tv", "now") }))}>
              <span>Help me find it</span>
            </button>
            <button className="cx-btn cx-btn--line cx-wide" data-bot="setup-skip-tv" onClick={() => store.update((x) => setupPatch(x, { step: "people" }))}>
              <span>Skip for now: play on phones</span>
            </button>
          </div>
        }
      >
        <div className="fr-search fr-search--none" aria-hidden>
          <span className="fr-search__pulse"><TvIcon size={34} /></span>
          <span className="ogs-path-h fr-search__dots" />
        </div>
        <p className="fr-note">You can connect the TV later from Household. Nothing else waits on it.</p>
      </StepFrame>
    );
  }
  const searching = tv === "searching";
  return (
    <StepFrame
      s={s}
      store={store}
      back="welcome"
      title={tv === "connected" ? "Living room TV is ready" : searching ? "Looking for your TV" : "Which TV is the living room?"}
      lede={tv === "connected" ? "Games cast to it from now on. Nothing was installed on it, and nobody can play from the TV itself." : "Same Wi-Fi as this phone. We cast to it; nothing gets installed."}
      dock={
        <button className="cx-btn cx-btn--light cx-wide" data-bot="setup-people" disabled={tv !== "connected"} onClick={() => store.update((x) => setupPatch(x, { step: "people", people: x.setup.people.length ? x.setup.people : ["dad"] }))}>
          <span>{tv === "connected" ? "Next: who plays here" : "Connect a TV to go on"}</span>
        </button>
      }
    >
      {searching ? (
        <div className="fr-search" role="status">
          <span className="fr-search__pulse"><TvIcon size={34} /></span>
          <span className="ogs-path-h fr-search__dots" aria-hidden />
          <span className="fr-search__text"><Spinner size={18} /> Looking on this Wi-Fi</span>
        </div>
      ) : (
        <Found s={s} store={store} />
      )}
    </StepFrame>
  );
}
