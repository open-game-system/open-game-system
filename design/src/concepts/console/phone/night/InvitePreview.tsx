// "See what they see": the invitation exactly as Nana & Pop's phone shows it. Their accept and
// decline are theirs, so here they are shown, not pressed.
import type { Store } from "../../../../harness/store";
import { gameById } from "../../../../world";
import { household, screenWords, short, US, type Night } from "../../nights";
import type { S } from "../../state";
import { Crest } from "../../ui/Sticker";
import { GameArt } from "../../ui/GameArt";
import { Close } from "../../ui/Icons";

export function InvitePreview({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  const them = n.homes.find((h) => h.householdId === "hh-nana") ?? n.homes.find((h) => h.householdId !== US);
  const us = n.homes.find((h) => h.householdId === US);
  if (!them || !us) return null;
  const close = () => store.update((x) => ({ ...x, nights: { ...x.nights, preview: false } }));
  const coming = n.homes.filter((h) => h.householdId !== them.householdId).map((h) => h.name);
  return (
    <div className="cx-sheetwrap">
      <button className="cx-scrim" aria-label="Close preview" onClick={close} />
      <div className="cx-sheet cx-sheet--dark" role="dialog" aria-label={`What ${them.name} see`}>
        <div className="cx-sheet__grab" />
        <div className="cx-preview__head">
          <span>What {short(them.name)} see on their phone</span>
          <button className="cx-iconbtn" data-bot="preview-close" aria-label="Close" onClick={close}>
            <Close size={20} />
          </button>
        </div>
        <article className="cx-invite">
          <div className="cx-invite__art">
            <GameArt gameId={n.gameId} />
          </div>
          <div className="cx-invite__body">
            <span className="cx-invite__from">
              <Crest household={household(US)} size={30} shared /> {us.name}{s.nights.kidNames ? " (Jonathan, Juneau)" : ""} invited you
            </span>
            <h3>{gameById(n.gameId).name} game night</h3>
            <dl>
              <dt>When</dt>
              <dd>{n.when ?? "Tonight"} · about an hour</dd>
              <dt>Your seat</dt>
              <dd>{them.name} · {them.colorName}</dd>
              <dt>Play on</dt>
              <dd>{them.screen === "phones" ? "Your phones. No TV needed" : screenWords(them)}</dd>
              <dt>Also coming</dt>
              <dd>{coming.join(" · ")}</dd>
            </dl>
            <div className="cx-invite__actions" aria-hidden>
              <span className="cx-btn cx-btn--light">Accept</span>
              <span className="cx-btn cx-btn--line">Decline</span>
            </div>
          </div>
        </article>
        <p className="cx-preview__note">They see your household name and seat colour. Never the kids' pictures.</p>
      </div>
    </div>
  );
}
