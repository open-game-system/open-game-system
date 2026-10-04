// Pick a sticker: the painted paper characters. One per person in a household, so no two people
// at home look the same; a sticker someone else at home already has says whose it is.
import type { Store } from "../../../../harness/store";
import { HOUSEHOLDS } from "../../../../world";
import { setupPatch, setupPeople, type S } from "../../state";
import { Close } from "../../ui/Icons";
import { Sticker } from "../../ui/Sticker";

/** Every sticker in the set, once (the world's people carry them). */
const SET: string[] = [...new Set(HOUSEHOLDS.flatMap((h) => h.people.map((p) => p.sticker)))];
const nameOf = (src: string): string => (src.split("char-")[1] ?? "").replace(".webp", "");

export function StickerSheet({ s, store }: { s: S; store: Store<S> }) {
  const people = setupPeople(s.setup);
  const who = people.find((p) => p.id === s.setup.picking);
  if (!who) return null;
  const close = () => store.update((x) => setupPatch(x, { picking: null }));
  return (
    <div className="cx-sheetwrap">
      <button className="cx-scrim" aria-label="Close" onClick={close} />
      <div className="cx-sheet cx-sheet--dark" role="dialog" aria-label={`Pick ${who.name}'s sticker`}>
        <div className="cx-sheet__grab" />
        <div className="cx-preview__head">
          <h3 className="cx-who__h">Pick {who.name}'s sticker</h3>
          <button className="cx-iconbtn" data-bot="sticker-close" aria-label="Close" onClick={close}>
            <Close size={20} />
          </button>
        </div>
        <ul className="fr-stickers">
          {SET.map((src) => {
            const owner = people.find((p) => p.sticker === src && p.id !== who.id);
            const mine = who.sticker === src;
            return (
              <li key={src}>
                <button
                  className={`fr-stickers__pick ${mine ? "is-on" : ""}`}
                  data-bot={`pick-${nameOf(src)}`}
                  disabled={!!owner}
                  aria-pressed={mine}
                  aria-label={owner ? `${nameOf(src)}, ${owner.name}'s` : nameOf(src)}
                  onClick={() => store.update((x) => setupPatch(x, { picking: null, stickers: { ...x.setup.stickers, [who.id]: src } }))}
                >
                  <Sticker person={{ ...who, id: `${who.id}-${nameOf(src)}`, sticker: src }} size={78} dim={!!owner} />
                  <span>{owner ? `${owner.name}'s` : mine ? "Picked" : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
