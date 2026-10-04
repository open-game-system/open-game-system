// Pinned at the top of every night's thread: what the other homes see of us. Our crest as they see
// it (the grown-ups' stickers only), our name and seat, and one tap to read the whole thread from
// their side. While writing an invite, the one choice (Juneau's name) sits right here.
import type { Store } from "../../../../harness/store";
import { household, US } from "../../nights";
import type { S } from "../../state";
import { Eye } from "../../ui/Icons";
import { Crest } from "../../ui/Sticker";
import { seenAs } from "./words";

export function KidNames({ s, store }: { s: S; store: Store<S> }) {
  const on = s.nights.kidNames;
  return (
    <label className="nt-kid">
      <span>
        <b>{on ? "Juneau's name is shown" : "Show Juneau's name"}</b>
        <span>{on ? "Off again any time; it leaves every home's thread at once." : "Off. Kids are only ever your crest."}</span>
      </span>
      <input type="checkbox" role="switch" data-bot="kid-names" checked={on} onChange={() => store.update((x) => ({ ...x, nights: { ...x.nights, kidNames: !x.nights.kidNames } }))} />
    </label>
  );
}

export function Seen({ s, store, draft, preview }: { s: S; store: Store<S>; draft: boolean; preview: string }) {
  const them = household(preview).name;
  const n = s.nights.list.find((x) => x.id === s.nights.open);
  const split = !!n?.homes.some((h) => h.householdId === US && h.seat === "split");
  return (
    <section className={`nt-seen ${draft ? "is-draft" : ""}`} aria-label="What other homes see of us">
      <div className="nt-seen__row">
        <Crest household={household(US)} size={36} shared />
        <p>
          <span>Other homes see</span>
          <b>{seenAs(s.nights.kidNames, split)}</b>
        </p>
        {!draft && (
          <button className="nt-seen__as" data-bot="invite-preview" aria-label={`Read this thread as ${them} see it`} onClick={() => store.update((x) => ({ ...x, nights: { ...x.nights, preview: true } }))}>
            <Eye size={18} /> <span>Their view</span>
          </button>
        )}
      </div>
      {draft && <KidNames s={s} store={store} />}
      {draft && <span className="nt-seen__fine">Only homes you invite can open this thread.</span>}
    </section>
  );
}
