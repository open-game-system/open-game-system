// First run, stop 2: who plays here. Each person has a name, an age (which decides their seat:
// grown-ups read, kids get controls with no words) and a sticker they pick. Family Sharing
// suggests the rest of the household, so nobody types four names.
import type { Store } from "../../../../harness/store";
import { HOME, type Person } from "../../../../world";
import { setupPatch, setupPeople, type S } from "../../state";
import { Plus } from "../../ui/Icons";
import { Sticker } from "../../ui/Sticker";
import { StepFrame } from "./parts";
import { StickerSheet } from "./StickerSheet";

export const ageWords = (p: Person): string =>
  p.band === "grownup" ? (p.id === "dad" ? "Grown-up · you, on this phone" : "Grown-up · reads the game") : p.band === "kid" ? `${p.age ?? ""} · reads a few words` : `${p.age ?? ""} · the littlest: mashes, can't break anything`;

export function PeopleStep({ s, store }: { s: S; store: Store<S> }) {
  const added = setupPeople(s.setup);
  const suggested = HOME.people.filter((p) => !s.setup.people.includes(p.id));
  return (
    <>
      <StepFrame
        s={s}
        store={store}
        back="tv"
        title="Who plays here?"
        lede="Once, for every game. Ages decide each person's seat; the sticker is how every screen shows them."
        dock={
          <button className="cx-btn cx-btn--light cx-wide" data-bot="setup-ipads" disabled={added.length < 2} onClick={() => store.update((x) => setupPatch(x, { step: "ipads" }))}>
            <span>{added.length < 2 ? "Add who you play with" : `Next: the kids' iPads`}</span>
          </button>
        }
      >
        <ul className="fr-people">
          {added.map((p) => (
            <li key={p.id}>
              <Sticker person={p} size={56} />
              <span className="fr-people__text">
                <b>{p.name}</b>
                <span>{ageWords(p)}</span>
              </span>
              <button className="cx-btn cx-btn--line cx-btn--sm" data-bot={`sticker-${p.id}`} aria-label={`Change ${p.name}'s sticker`} onClick={() => store.update((x) => setupPatch(x, { picking: p.id }))}>
                <span>Sticker</span>
              </button>
            </li>
          ))}
        </ul>
        {suggested.length > 0 && (
          <>
            <h2 className="cx-subh">From your Family Sharing</h2>
            <ul className="fr-suggest">
              {suggested.map((p) => (
                <li key={p.id}>
                  <button className="fr-suggest__row" data-bot={`add-${p.id}`} onClick={() => store.update((x) => setupPatch(x, { people: [...x.setup.people, p.id] }))}>
                    <Plus size={20} />
                    <span>
                      <b>Add {p.name}</b>
                      <span>{p.band === "grownup" ? "Grown-up" : `Age ${p.age ?? ""}`}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </StepFrame>
      {s.setup.picking && <StickerSheet s={s} store={store} />}
    </>
  );
}
