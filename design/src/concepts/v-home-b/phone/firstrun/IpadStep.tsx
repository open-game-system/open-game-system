// First run, stop 3: pair each kid's iPad once ("this iPad is Juneau's"). The iPad shows the
// household's stickers; tapping Juneau's dragon there asks this phone to confirm. Paired iPads can
// be unpaired here any time (and again from Household).
import type { Store } from "../../../../harness/store";
import { HOME } from "../../../../world";
import { pairIpad, setupPatch, setupPeople, type S } from "../../state";
import { Check, TabletIcon } from "../../ui/Icons";
import { Sticker } from "../../ui/Sticker";
import { StepFrame } from "./parts";

function IpadRow({ s, store, id }: { s: S; store: Store<S>; id: string }) {
  const p = setupPeople(s.setup).find((x) => x.id === id);
  const d = HOME.devices.find((x) => x.personId === id && x.kind === "ipad");
  if (!p || !d) return null;
  const state = s.setup.ipads[id] ?? "unpaired";
  return (
    <li className={`fr-ipad fr-ipad--${state}`}>
      <div className="fr-ipad__top">
        <span className="fr-ipad__dev">
          <TabletIcon size={40} />
          <Sticker person={p} size={30} className="fr-ipad__who" />
        </span>
        <span className="fr-people__text">
          <b>{d.name}</b>
          <span>{state === "paired" ? "Paired · follows tonight's game" : state === "waiting" ? "Waiting for the iPad" : "Not paired yet"}</span>
        </span>
        {state === "unpaired" && (
          <button className="cx-btn cx-btn--light cx-btn--sm" data-bot={`pair-${id}`} onClick={() => store.update((x) => pairIpad(x, id, "waiting"))}>
            <span>Pair</span>
          </button>
        )}
        {state === "paired" && (
          <button className="cx-btn cx-btn--line cx-btn--sm" data-bot={`unpair-${id}`} onClick={() => store.update((x) => setupPatch(x, { unpair: id }))}>
            <span>Unpair</span>
          </button>
        )}
      </div>
      {state === "waiting" && (
        <div className="fr-ipad__how">
          <p>On {p.name}'s iPad, open <b>opengame.org</b> and tap {p.name}'s sticker.</p>
          <button className="cx-btn cx-btn--light cx-wide" data-bot={`confirm-${id}`} onClick={() => store.update((x) => pairIpad(x, id, "paired"))}>
            <Check size={18} /> <span>An iPad picked {p.name}: that's it</span>
          </button>
        </div>
      )}
    </li>
  );
}

function UnpairSheet({ s, store }: { s: S; store: Store<S> }) {
  const id = s.setup.unpair;
  const p = setupPeople(s.setup).find((x) => x.id === id);
  if (!id || !p) return null;
  const close = () => store.update((x) => setupPatch(x, { unpair: null }));
  return (
    <div className="cx-sheetwrap">
      <button className="cx-scrim" aria-label="Close" onClick={close} />
      <div className="cx-sheet cx-sheet--dark" role="dialog" aria-label={`Unpair ${p.name}'s iPad`}>
        <div className="cx-sheet__grab" />
        <div className="fr-unpair">
          <Sticker person={p} size={64} />
          <h3 className="cx-who__h">Unpair {p.name}'s iPad?</h3>
          <p className="cx-who__sub">It stops following tonight's game and goes back to the pairing screen. {p.name}'s sticker, seat and saves stay with the household. Pair it again any time.</p>
        </div>
        <div className="fr-dock__two">
          <button className="cx-btn cx-btn--light cx-wide" data-bot="unpair-cancel" onClick={close}>
            <span>Keep it paired</span>
          </button>
          <button className="cx-btn cx-btn--line cx-wide" data-bot="unpair-confirm" onClick={() => store.update((x) => pairIpad(x, id, "unpaired"))}>
            <span>Unpair {p.name}'s iPad</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function IpadStep({ s, store }: { s: S; store: Store<S> }) {
  const kids = setupPeople(s.setup).filter((p) => p.band !== "grownup");
  const paired = kids.filter((k) => s.setup.ipads[k.id] === "paired").length;
  return (
    <>
      <StepFrame
        s={s}
        store={store}
        back="people"
        title="Pair the kids' iPads"
        lede="Once per iPad. After that it follows tonight's game by itself: no codes, no scanning, no picking a role."
        dock={
          <button className="cx-btn cx-btn--light cx-wide" data-bot="setup-done" onClick={() => store.update((x) => setupPatch(x, { step: "ready" }))}>
            <span>{paired === kids.length ? "Done" : paired === 0 ? "Skip: pair them later" : `Done for now · ${paired} of ${kids.length} paired`}</span>
          </button>
        }
      >
        <ul className="fr-ipads">
          {kids.map((k) => (
            <IpadRow key={k.id} s={s} store={store} id={k.id} />
          ))}
        </ul>
      </StepFrame>
      {s.setup.unpair && <UnpairSheet s={s} store={store} />}
    </>
  );
}
