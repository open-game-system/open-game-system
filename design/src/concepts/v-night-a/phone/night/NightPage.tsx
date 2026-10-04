// A game night's page on the phone: one calm thread among the homes. Pinned at the top, what the
// other homes see of us; then the timeline (invite, replies, seat picks, rolls, pauses, "back Fri
// 8:00"), what's happening now, and the board as the thread's live attachment; at the foot, the one
// thing to do next. Setting up a new night is the same thread being written: there are no steps.
import { useLayoutEffect, useRef } from "react";
import type { Store } from "../../../../harness/store";
import { gameById } from "../../../../world";
import { nightOpen, short, US, type Night } from "../../nights";
import { goHome, type S } from "../../state";
import { StatusBar } from "../../ui/Brand";
import { Chevron, Eye } from "../../ui/Icons";
import { Crest } from "../../ui/Sticker";
import { household } from "../../nights";
import { Composer } from "./Composer";
import { Draft, DraftDock } from "./Draft";
import { KidNames, Seen } from "./Seen";
import { Thread } from "./Thread";

/** The home whose view the preview shows: the one with no TV, so the least like ours. */
const PREVIEW = "hh-nana";

function Header({ n, draft }: { n: Night | undefined; draft: boolean }) {
  const homes = n?.homes.filter((h) => h.reply !== "declined") ?? [];
  return (
    <header className="nt-head">
      <h1 className="ogs-display">{draft || !n ? "New Hearthisle night" : `${gameById(n.gameId).name} night`}</h1>
      {!draft && n && (
        <p className="nt-head__homes">
          {homes.map((h) => (
            <span key={h.householdId}>
              <Crest household={household(h.householdId)} size={26} shared={h.householdId !== US} />
              {short(h.name)}
            </span>
          ))}
        </p>
      )}
    </header>
  );
}

export function NightPage({ s, store }: { s: S; store: Store<S> }) {
  const n = nightOpen(s.nights);
  const draft = !n || (s.nights.step === "invite" && n.status !== "setup");
  const scroll = useRef<HTMLDivElement>(null);
  const size = `${n?.id}:${n?.log.length}:${s.nights.step}:${n?.status}:${n?.turn}`;
  // A thread opens at its latest entry (and stays there as new ones land).
  useLayoutEffect(() => {
    const el = scroll.current;
    if (el && !draft) el.scrollTop = el.scrollHeight;
  }, [size, draft]);
  const previewing = s.nights.preview && n && !draft;
  if (previewing && n) return <TheirView n={n} s={s} store={store} />;
  return (
    <div className="cx-phone cx-nightpage nt">
      <StatusBar dark />
      <div className="cx-topbar">
        <button className="cx-back" data-bot="night-back" onClick={() => store.update(goHome)}>
          <Chevron size={20} dir="left" /> Home
        </button>
      </div>
      <Header n={n} draft={draft} />
      <Seen s={s} store={store} draft={draft} preview={PREVIEW} />
      <div className="nt-scroll" ref={scroll}>
        {draft ? <Draft s={s} store={store} /> : n && <Thread n={n} s={s} store={store} viewer={US} />}
      </div>
      {draft ? <DraftDock s={s} store={store} /> : n && <Composer n={n} s={s} store={store} />}
    </div>
  );
}

/** "Their view": the same thread, as Nana & Pop's phone shows it (a whole page, so nothing of ours sits under it). */
function TheirView({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  const close = () => store.update((x) => ({ ...x, nights: { ...x.nights, preview: false } }));
  return (
    <div className="cx-phone cx-nightpage nt nt--theirs">
      <StatusBar dark />
      <div className="nt-theirbar">
        <span>
          <Eye size={18} /> <b>On {household(PREVIEW).name}'s phone</b>
        </span>
        <button className="cx-btn cx-btn--light cx-btn--sm" data-bot="preview-close" onClick={close}>
          Back to ours
        </button>
      </div>
      <header className="nt-head">
        <h1 className="ogs-display">{gameById(n.gameId).name} night</h1>
      </header>
      <div className="nt-seen">
        <p className="nt-seen__fine">Your setting, only you can change it: what they get of your kids.</p>
        <KidNames s={s} store={store} />
      </div>
      <div className="nt-scroll nt-scroll--rev">
        <Thread n={n} s={s} store={store} viewer={PREVIEW} />
      </div>
    </div>
  );
}
