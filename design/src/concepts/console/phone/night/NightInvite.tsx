// Step 1 of a new game night: which homes. Before sending, pick homes (and see that the paused
// night keeps its place); after sending, each home's reply, and what they see.
import type { Store } from "../../../../harness/store";
import { HOUSEHOLDS } from "../../../../world";
import { anotherNight, declined, dropDeclined, inviteInstead, nightLine, sendInvites, togglePick, toStep, US, type Night, type Nights, whenWords } from "../../nights";
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
          <b>Your other night stays put.</b> {nightLine(p)}: it keeps its place and stays in Coming up until every home is back.
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

function Replies({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  const out = declined(n);
  if (out.length > 0) return <Declined n={n} s={s} store={store} />;
  const waiting = n.homes.filter((h) => h.reply === "invited").length;
  return (
    <div className="cx-setup2">
      <h1 className="cx-title">{waiting > 0 ? "Invites sent" : "Everyone's in"}</h1>
      <p className="cx-lede">{waiting > 0 ? `For ${whenWords(n.when)}. You can pick seats while they answer.` : `Every home said yes for ${whenWords(n.when)}. Next, the seats.`}</p>
      {s.nights.link && <p className="cx-keeps">Invite link ready to send. Whoever opens it takes the free seat; you'll see their name here first.</p>}
      <HomeRows n={n} store={store} mode="status" />
      <button className="cx-btn cx-btn--line cx-wide" data-bot="invite-preview" onClick={() => store.update((x) => ({ ...x, nights: { ...x.nights, preview: true } }))}>
        <Eye size={18} /> <span>See what the other homes see</span>
      </button>
      <div className="cx-dock">
        <button className="cx-btn cx-btn--light cx-wide" data-bot="night-seats" onClick={() => store.update((x) => ({ ...x, nights: toStep(x.nights, "seats") }))}>
          <span>Next: seats</span>
        </button>
      </div>
    </div>
  );
}

/** A home said no. Say who, then the three honest ways on: fewer homes, someone else, another night. */
function Declined({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  const out = declined(n);
  const names = out.map((h) => h.name).join(" and ");
  const yes = n.homes.filter((h) => h.householdId !== US && h.reply === "in").map((h) => h.name);
  const playing = n.homes.filter((h) => h.reply !== "declined").length;
  const pick = (f: (ns: Nights) => Nights) => store.update((x) => ({ ...x, nights: f(x.nights) }));
  return (
    <div className="cx-setup2">
      <h1 className="cx-title">{names} can't make it</h1>
      <p className="cx-lede">
        They said no to {whenWords(n.when)}.{yes.length > 0 ? ` ${yes.join(" and ")} are in.` : ""} Nothing has started, so nothing is lost.
      </p>
      <HomeRows n={n} store={store} mode="status" />
      <h2 className="cx-subh">What now?</h2>
      <ul className="cx-choices">
        <li>
          <button className="cx-choice" data-bot="decline-play-on" onClick={() => pick((ns) => toStep(dropDeclined(ns), "seats"))}>
            <b>Play with {playing} homes</b>
            <span>Start {whenWords(n.when)} without them. Their seat leaves the board.</span>
          </button>
        </li>
        <li>
          <button className="cx-choice" data-bot="decline-invite-other" onClick={() => pick(inviteInstead)}>
            <b>Invite someone else</b>
            <span>Send a link. Whoever opens it takes the free seat.</span>
          </button>
        </li>
        <li>
          <button className="cx-choice" data-bot="decline-other-night" onClick={() => pick((ns) => anotherNight(ns, "Sat 8:00"))}>
            <b>Pick another night</b>
            <span>Ask every home about Saturday 8:00 instead.</span>
          </button>
        </li>
      </ul>
    </div>
  );
}

export function NightInvite({ n, s, store }: { n: Night | undefined; s: S; store: Store<S> }) {
  return n && n.status === "setup" ? <Replies n={n} s={s} store={store} /> : <Picker s={s} store={store} />;
}
