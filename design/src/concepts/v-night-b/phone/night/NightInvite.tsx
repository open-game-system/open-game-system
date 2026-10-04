// Step 1 of a new game night: make the card. Before sending, address it (which homes get one; the
// paused night keeps its ribbon); after sending, each home answers on its copy, and we can look at
// Nana & Pop's copy exactly as it reaches them.
import type { Store } from "../../../../harness/store";
import { HOUSEHOLDS } from "../../../../world";
import { anotherNight, declined, dropDeclined, inviteInstead, sendInvites, togglePick, toStep, US, type Night, type Nights, whenWords } from "../../nights";
import type { S } from "../../state";
import { Check, Eye, Plus } from "../../ui/Icons";
import { InviteBack, InviteFront, Ribbon, cardHomes, ribbonWords, type CardHome } from "./card";
import { KidNamesSwitch } from "./Trust";

function Picker({ s, store }: { s: S; store: Store<S> }) {
  const paused = s.nights.list.filter((n) => n.status === "paused");
  const homes = HOUSEHOLDS.filter((h) => h.id !== US);
  const picked = s.nights.picked;
  const draft: CardHome[] = HOUSEHOLDS.filter((h) => h.id === US || picked.includes(h.id)).map((house): CardHome => ({ id: house.id, house, stamp: house.id === US ? { kind: "host", word: "Hosting" } : null }));
  return (
    <div className="iv-page">
      <h1 className="iv-title">Make the card</h1>
      <p className="iv-lede">Each home gets this card and answers on it.</p>
      {paused.map((p) => (
        <div key={p.id} className="iv-keeps">
          <Ribbon words={ribbonWords(p)} />
          <p>Your other card keeps its ribbon. It opens again when every home is back.</p>
        </div>
      ))}
      <InviteFront gameId="hearthisle" when="Tonight 8:00" homes={draft} />
      <h2 className="iv-subh">Send a copy to</h2>
      <ul className="iv-address">
        {homes.map((h) => {
          const on = picked.includes(h.id);
          return (
            <li key={h.id}>
              <button className={`iv-address__row ${on ? "is-on" : ""}`} role="checkbox" aria-checked={on} data-bot={`pick-${h.id}`} onClick={() => store.update((x) => ({ ...x, nights: togglePick(x.nights, h.id) }))}>
                <span className="iv-address__box">{on && <Check size={18} />}</span>
                <span className="iv-address__text">
                  <b>{h.name}</b>
                  <span>
                    {h.city} · {h.devices.some((d) => d.kind === "tv") ? "has a TV" : "phones only"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <button className="iv-address__row" data-bot="invite-link">
            <span className="iv-address__box">
              <Plus size={18} />
            </span>
            <span className="iv-address__text">
              <b>Another home</b>
              <span>Send a copy by link</span>
            </span>
          </button>
        </li>
      </ul>
      <h2 className="iv-subh">The back</h2>
      <InviteBack to={homes.filter((h) => picked.includes(h.id)).map((h) => h.name)} kidNames={s.nights.kidNames} seat="blue">
        <KidNamesSwitch s={s} store={store} />
      </InviteBack>
      <div className="iv-dock">
        <button className="cx-btn iv-btn iv-wide" data-bot="invite-send" disabled={picked.length === 0} onClick={() => store.update((x) => ({ ...x, nights: sendInvites(x.nights) }))}>
          <span>{picked.length === 0 ? "Pick a home to send it to" : `Send ${picked.length} card${picked.length > 1 ? "s" : ""}`}</span>
        </button>
      </div>
    </div>
  );
}

function Replies({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  const out = declined(n);
  if (out.length > 0) return <Declined n={n} store={store} />;
  const waiting = n.homes.filter((h) => h.reply === "invited").length;
  return (
    <div className="iv-page">
      <h1 className="iv-title">{waiting > 0 ? "The cards are out" : "Everyone's coming"}</h1>
      <p className="iv-lede">{waiting > 0 ? `Each home answers on its copy. You can set the table while they decide.` : `Every home stamped yes for ${whenWords(n.when)}. Next, set the table.`}</p>
      {s.nights.link && <p className="iv-lede">A copy is ready to send by link. Whoever opens it takes the free place; you'll see their name here first.</p>}
      <button className="cx-btn iv-btn iv-btn--line iv-wide iv-wide--top" data-bot="invite-preview" onClick={() => store.update((x) => ({ ...x, nights: { ...x.nights, preview: true } }))}>
        <Eye size={18} /> <span>See Nana & Pop's copy</span>
      </button>
      <InviteFront gameId={n.gameId} when={n.when} homes={cardHomes(n)} />
      <div className="iv-dock">
        <button className="cx-btn iv-btn iv-wide" data-bot="night-seats" onClick={() => store.update((x) => ({ ...x, nights: toStep(x.nights, "seats") }))}>
          <span>Next: set the table</span>
        </button>
      </div>
    </div>
  );
}

/** A home sent its regrets. Say who, then the three honest ways on: fewer homes, someone else, another night. */
function Declined({ n, store }: { n: Night; store: Store<S> }) {
  const out = declined(n);
  const names = out.map((h) => h.name).join(" and ");
  const yes = n.homes.filter((h) => h.householdId !== US && h.reply === "in").map((h) => h.name);
  const playing = n.homes.filter((h) => h.reply !== "declined").length;
  const pick = (f: (ns: Nights) => Nights) => store.update((x) => ({ ...x, nights: f(x.nights) }));
  return (
    <div className="iv-page">
      <h1 className="iv-title">{names} sent regrets</h1>
      <p className="iv-lede">
        Not {whenWords(n.when)}.{yes.length > 0 ? ` ${yes.join(" and ")} are coming.` : ""} Nothing has started, so nothing is lost.
      </p>
      <InviteFront gameId={n.gameId} when={n.when} homes={cardHomes(n)} />
      <h2 className="iv-subh">What now?</h2>
      <ul className="iv-choices">
        <li>
          <button className="iv-choice" data-bot="decline-play-on" onClick={() => pick((ns) => toStep(dropDeclined(ns), "seats"))}>
            <b>Set the table for {playing}</b>
            <span>Start {whenWords(n.when)} without them. Their place comes off the table.</span>
          </button>
        </li>
        <li>
          <button className="iv-choice" data-bot="decline-invite-other" onClick={() => pick(inviteInstead)}>
            <b>Send a copy to someone else</b>
            <span>By link. Whoever opens it takes the free place.</span>
          </button>
        </li>
        <li>
          <button className="iv-choice" data-bot="decline-other-night" onClick={() => pick((ns) => anotherNight(ns, "Sat 8:00"))}>
            <b>Change the date</b>
            <span>A new card for Saturday 8:00 goes to every home.</span>
          </button>
        </li>
      </ul>
    </div>
  );
}

export function NightInvite({ n, s, store }: { n: Night | undefined; s: S; store: Store<S> }) {
  return n && n.status === "setup" ? <Replies n={n} s={s} store={store} /> : <Picker s={s} store={store} />;
}
