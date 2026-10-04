// Nana & Pop's copy, exactly as it reaches their phone: the same card, addressed to them, with the
// two answers they can stamp on it. Their answer is theirs, so here it is shown, not pressed.
import type { Store } from "../../../../harness/store";
import { short, US, type Night } from "../../nights";
import type { S } from "../../state";
import { Close } from "../../ui/Icons";
import { InviteFront, cardHomes } from "./card";

export function InvitePreview({ n, store }: { n: Night; s: S; store: Store<S> }) {
  const them = n.homes.find((h) => h.householdId === "hh-nana") ?? n.homes.find((h) => h.householdId !== US);
  if (!them) return null;
  const close = () => store.update((x) => ({ ...x, nights: { ...x.nights, preview: false } }));
  return (
    <div className="cx-sheetwrap">
      <button className="cx-scrim" aria-label="Close preview" onClick={close} />
      <div className="cx-sheet iv-sheet" role="dialog" aria-label={`${them.name}'s copy`}>
        <div className="iv-sheet__head">
          <span>{short(them.name)}'s copy, on Nana's phone</span>
          <button className="cx-iconbtn iv-sheet__close" data-bot="preview-close" aria-label="Close" onClick={close}>
            <Close size={20} />
          </button>
        </div>
        <InviteFront gameId={n.gameId} when={n.when} homes={cardHomes(n).map((h) => (h.id === them.householdId ? { ...h, stamp: null } : h))} to={them.name} compact>
          <div className="iv-answer" aria-hidden>
            <span className="iv-answer__slot iv-answer__slot--yes">Yes, we'll come</span>
            <span className="iv-answer__slot">Can't make it</span>
          </div>
          <p className="iv-card__foot">Your place: {them.colorName} · {them.screen === "phones" ? "on your phones, no TV needed" : "on your TV"}</p>
        </InviteFront>
      </div>
    </div>
  );
}
