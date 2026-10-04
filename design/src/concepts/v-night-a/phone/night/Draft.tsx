// A new night starts as an unsent first entry: the invite, exactly as every home will see it in the
// thread, with who it goes to. The paused night above keeps its place (it is its own thread).
import type { Store } from "../../../../harness/store";
import { gameById, HOUSEHOLDS } from "../../../../world";
import { household, sendInvites, togglePick, US, whenWords } from "../../nights";
import type { S } from "../../state";
import { GameArt } from "../../ui/GameArt";
import { Check, Plus } from "../../ui/Icons";
import { Crest } from "../../ui/Sticker";

export function Draft({ s, store }: { s: S; store: Store<S> }) {
  const paused = s.nights.list.filter((n) => n.status === "paused");
  const picked = s.nights.picked;
  const homes = HOUSEHOLDS.filter((h) => h.id !== US);
  return (
    <ol className="nt-thread nt-thread--draft">
      {paused.map((p) => (
        <li key={p.id} className="nt-row nt-keeps">
          <span className="nt-node nt-node--turn ogs-display">{p.turn}</span>
          <div className="nt-row__body">
            <p className="nt-row__line">
              <b>Your turn-{p.turn} night keeps its place.</b> It's its own thread, back {whenWords(p.when)}.
            </p>
          </div>
        </li>
      ))}
      <li className="nt-day">
        <span>Today · not sent yet</span>
      </li>
      <li className="nt-row is-mine nt-row--draft">
        <span className="nt-node">
          <Crest household={household(US)} size={40} />
        </span>
        <div className="nt-row__body">
          <p className="nt-row__line">
            <b>You</b> invite homes
          </p>
          <div className="nt-invite">
            <span className="nt-invite__art">
              <GameArt gameId="hearthisle" alt />
            </span>
            <span className="nt-invite__body">
              <b className="ogs-display">{gameById("hearthisle").name} game night</b>
              <span>Tonight 8:00 · about an hour</span>
            </span>
          </div>
          <p className="nt-to">To</p>
          <ul className="nt-pick">
            {homes.map((h) => {
              const on = picked.includes(h.id);
              return (
                <li key={h.id}>
                  <button role="checkbox" aria-checked={on} className={on ? "is-on" : ""} data-bot={`pick-${h.id}`} onClick={() => store.update((x) => ({ ...x, nights: togglePick(x.nights, h.id) }))}>
                    <Crest household={h} size={34} shared />
                    <span>
                      <b>{h.name}</b>
                      <span>{h.city} · {h.devices.some((d) => d.kind === "tv") ? "their TV" : "phones, no TV"}</span>
                    </span>
                    <span className="nt-pick__box">{on && <Check size={18} />}</span>
                  </button>
                </li>
              );
            })}
            <li>
              <button className="nt-pick__link" data-bot="invite-link">
                <Plus size={18} /> <span>Another home, by link</span>
              </button>
            </li>
          </ul>
        </div>
      </li>
    </ol>
  );
}

export function DraftDock({ s, store }: { s: S; store: Store<S> }) {
  const picked = s.nights.picked;
  return (
    <div className="nt-dock">
      <div className="nt-dock__row">
        <button className="cx-btn cx-btn--light nt-wide" data-bot="invite-send" disabled={picked.length === 0} onClick={() => store.update((x) => ({ ...x, nights: sendInvites(x.nights) }))}>
          {picked.length === 0 ? "Pick a home to invite" : `Send to ${picked.length} home${picked.length > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
