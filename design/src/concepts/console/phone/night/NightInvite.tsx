// Step 1 of a new game night: which homes. Before sending, pick homes (and see that the paused
// night keeps its place); after sending, each home's reply, and what they see.
import type { Store } from "../../../../harness/store";
import { HOUSEHOLDS } from "../../../../world";
import { nightLine, sendInvites, togglePick, toStep, US, type Night } from "../../nights";
import type { S } from "../../state";
import { Check, Eye, Plus } from "../../ui/Icons";
import { HomeRows } from "./HomeRows";
import { Trust } from "./Trust";

function Picker({ s, store }: { s: S; store: Store<S> }) {
  const paused = s.nights.list.filter((n) => n.status === "paused");
  const homes = HOUSEHOLDS.filter((h) => h.id !== US);
  const picked = s.nights.picked;
  return (
    <div className="cx-setup2">
      <h1 className="cx-title">New Hearthisle night</h1>
      {paused.map((p) => (
        <p key={p.id} className="cx-keeps">
          <b>Your other night stays put.</b> {nightLine(p)}: it keeps its place and stays in Game nights until every home is back.
        </p>
      ))}
      <h2 className="cx-subh">Invite homes you play with</h2>
      <ul className="cx-homes">
        {homes.map((h) => {
          const on = picked.includes(h.id);
          return (
            <li key={h.id}>
              <button className={`cx-homes__row cx-pick ${on ? "is-on" : ""}`} role="checkbox" aria-checked={on} data-bot={`pick-${h.id}`} onClick={() => store.update((x) => ({ ...x, nights: togglePick(x.nights, h.id) }))}>
                <span className="cx-pick__box">{on && <Check size={18} />}</span>
                <span className="cx-homes__text">
                  <b>{h.name}</b>
                  <span>
                    {h.city} · {h.people.length} people · {h.devices.some((d) => d.kind === "tv") ? "has a TV" : "phones only"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button className="cx-btn cx-btn--line cx-wide" data-bot="invite-link">
        <Plus size={18} /> <span>Invite another home by link</span>
      </button>
      <Trust s={s} store={store} us={undefined} />
      <div className="cx-dock">
        <button className="cx-btn cx-btn--light cx-wide" data-bot="invite-send" disabled={picked.length === 0} onClick={() => store.update((x) => ({ ...x, nights: sendInvites(x.nights) }))}>
          <span>{picked.length === 0 ? "Pick a home to invite" : `Send ${picked.length} invite${picked.length > 1 ? "s" : ""}`}</span>
        </button>
      </div>
    </div>
  );
}

function Replies({ n, store }: { n: Night; store: Store<S> }) {
  const waiting = n.homes.filter((h) => h.reply === "invited").length;
  return (
    <div className="cx-setup2">
      <h1 className="cx-title">{waiting > 0 ? "Invites sent" : "Everyone's in"}</h1>
      <p className="cx-lede">{waiting > 0 ? "You can pick seats while they answer." : "Every home said yes. Next, the seats."}</p>
      <HomeRows n={n} store={store} mode="status" />
      <button className="cx-btn cx-btn--line cx-wide" data-bot="invite-preview" onClick={() => store.update((x) => ({ ...x, nights: { ...x.nights, preview: true } }))}>
        <Eye size={18} /> <span>See what Nana & Pop see</span>
      </button>
      <div className="cx-dock">
        <button className="cx-btn cx-btn--light cx-wide" data-bot="night-seats" onClick={() => store.update((x) => ({ ...x, nights: toStep(x.nights, "seats") }))}>
          <span>Next: seats</span>
        </button>
      </div>
    </div>
  );
}

export function NightInvite({ n, s, store }: { n: Night | undefined; s: S; store: Store<S> }) {
  return n && n.status === "setup" ? <Replies n={n} store={store} /> : <Picker s={s} store={store} />;
}
