// The foot of the thread: the one thing to do next, never a text box. While setting up it writes the
// next entry (seat picks, start); on a paused night it resumes; on a live one it pauses for every home
// (the board itself is opened from the thread's attachment).
import type { ReactNode } from "react";
import type { Store } from "../../../../harness/store";
import { anotherNight, beginNewNight, declined, everyoneBack, inviteInstead, dropDeclined, otherHomes, postSeats, short, toStep, toggleSplit, US, type Night, type Nights } from "../../nights";
import { night, pauseNightS, resumeNightS, startNightS, type S } from "../../state";
import { Plus, TvIcon } from "../../ui/Icons";

const Dock = ({ children, note }: { children: ReactNode; note?: string }) => (
  <div className="nt-dock">
    {note && <p className="nt-dock__note">{note}</p>}
    <div className="nt-dock__row">{children}</div>
  </div>
);

function SeatPicker({ n, store }: { n: Night; store: Store<S> }) {
  const split = n.homes.some((h) => h.householdId === US && h.seat === "split");
  const set = (want: boolean) => {
    if (want !== split) store.update((x) => ({ ...x, nights: toggleSplit(x.nights) }));
  };
  return (
    <div className="nt-dock nt-dock--seats">
      <p className="nt-dock__title">Our seat</p>
      <div className="nt-seatpick" role="radiogroup" aria-label="Our seat">
        <button role="radio" aria-checked={!split} className={!split ? "is-on" : ""} data-bot="seat-together" onClick={() => set(false)}>
          <i style={{ background: "#2f6fc8" }} />
          <b>Share blue</b>
          <span>Juneau rolls, you place</span>
        </button>
        <button role="radio" aria-checked={split} className={split ? "is-on" : ""} data-bot="seat-split" onClick={() => set(true)}>
          <i style={{ background: "#2f6fc8" }} />
          <i style={{ background: "#1f8a5b" }} />
          <b>Juneau gets green</b>
          <span>Two Mumm seats</span>
        </button>
      </div>
      <button className="cx-btn cx-btn--light nt-wide" data-bot="seats-next" onClick={() => store.update((x) => ({ ...x, nights: postSeats(x.nights) }))}>
        Post our seats to the thread
      </button>
    </div>
  );
}

export function Composer({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  const step = s.nights.step;
  const pick = (f: (ns: Nights) => Nights) => store.update((x) => ({ ...x, nights: f(x.nights) }));
  if (n.status === "setup") {
    const out = declined(n);
    if (out.length > 0 && step !== "where") {
      const playing = n.homes.filter((h) => h.reply !== "declined").length;
      return (
        <Dock note={`${out.map((h) => h.name).join(" and ")} can't make it. Nothing has started, so nothing is lost.`}>
          <div className="nt-choices">
            <button className="cx-btn cx-btn--light" data-bot="decline-play-on" onClick={() => pick((ns) => toStep(dropDeclined(ns), "seats"))}>
              Play with {playing} homes
            </button>
            <button className="cx-btn cx-btn--line" data-bot="decline-invite-other" onClick={() => pick(inviteInstead)}>
              Invite someone else
            </button>
            <button className="cx-btn cx-btn--line" data-bot="decline-other-night" onClick={() => pick((ns) => anotherNight(ns, "Sat 8:00"))}>
              Ask for Sat 8:00
            </button>
          </div>
        </Dock>
      );
    }
    if (step === "seats") return <SeatPicker n={n} store={store} />;
    if (step === "where") {
      const phones = n.homes.filter((h) => h.screen === "phones" && h.reply !== "declined").map((h) => h.name);
      return (
        <Dock note={`Each home opens the board on its own screen${phones.length ? `; ${phones.join(" and ")} on their phones` : ""}.`}>
          <button className="cx-btn cx-btn--light nt-wide" data-bot="night-start" onClick={() => store.update(startNightS)}>
            <TvIcon size={20} /> Start on the living room TV
          </button>
        </Dock>
      );
    }
    const waiting = n.homes.some((h) => h.reply === "invited");
    return (
      <Dock>
        <button className="cx-btn cx-btn--light nt-wide" data-bot="night-seats" onClick={() => pick((ns) => toStep(ns, "seats"))}>
          {waiting ? "Pick seats while they answer" : "Pick seats"}
        </button>
      </Dock>
    );
  }
  if (n.status === "live") {
    const others = otherHomes(n).map((h) => short(h.name)).join(" and ");
    return (
      <Dock note={`A pause stops the board for ${others} too. Every seat and hand is kept.`}>
        <button className="cx-btn cx-btn--line nt-wide" data-bot="night-pause" onClick={() => store.update((x) => pauseNightS(x, n.id))}>
          Pause for all {n.homes.length} homes
        </button>
      </Dock>
    );
  }
  const back = everyoneBack(n);
  const away = n.homes.filter((h) => !h.back).map((h) => short(h.name));
  return (
    <Dock>
      <button className="cx-btn cx-btn--light nt-grow" data-bot="night-resume" disabled={!back} onClick={() => store.update((x) => resumeNightS(x, n.id))}>
        <TvIcon size={20} /> {back ? `Resume turn ${n.turn} on the TV` : `Waiting on ${away.join(" and ")}`}
      </button>
      <button className="nt-iconbtn" data-bot="night-new-here" aria-label="New game night" onClick={() => store.update((x) => night(x, beginNewNight))}>
        <Plus size={22} />
      </button>
    </Dock>
  );
}
