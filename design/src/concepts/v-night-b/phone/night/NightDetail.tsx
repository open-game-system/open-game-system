// One game night is its invitation card. The front (art, date, the homes and their answers) wears a
// bookmark ribbon while it's paused; below it, the one thing to do next, the table as it's set
// tonight, and the back of the card (what every other home sees of us).
import type { Store } from "../../../../harness/store";
import { beginNewNight, everyoneBack, homeName, otherHomes, short, US, type Night, whenWords } from "../../nights";
import { night, pauseNightS, resumeNightS, type S } from "../../state";
import { Gamepad, Plus, TvIcon } from "../../ui/Icons";
import { InviteBack, InviteFront, cardHomes, ribbonWords } from "./card";
import { Table } from "./Table";
import { KidNamesSwitch } from "./Trust";

function Next({ n, store }: { n: Night; store: Store<S> }) {
  const others = otherHomes(n);
  const otherNames = others.map((h) => short(h.name)).join(" and ");
  if (n.status === "live") {
    const ours = n.turnOf === US;
    return (
      <div className="iv-next">
        <p>
          <b>{ours ? `Our roll, turn ${n.turn}` : `${short(homeName(n, n.turnOf))} are rolling · turn ${n.turn}`}</b>
          <span>{ours ? "On the living room TV. Juneau shares the blue place with you." : "Ours comes next. It will show up in Your turn."}</span>
        </p>
        <div className="iv-next__actions">
          <button className="cx-btn iv-btn" data-bot="night-controller" onClick={() => store.update((x) => ({ ...x, phone: "controller" }))}>
            <Gamepad size={20} /> <span>Controller</span>
          </button>
          <button className="cx-btn iv-btn iv-btn--line" data-bot="night-pause" onClick={() => store.update((x) => pauseNightS(x, n.id))}>
            <span>Pause · mark turn {n.turn}</span>
          </button>
        </div>
        <p className="iv-next__note">A pause marks turn {n.turn} for {otherNames} too. Every place and hand is kept; the card comes back next Friday 8:00.</p>
      </div>
    );
  }
  const back = everyoneBack(n);
  const away = n.homes.filter((h) => !h.back).map((h) => short(h.name));
  const by = n.pausedBy === US ? "You marked it" : n.pausedBy ? `${short(homeName(n, n.pausedBy))} marked it` : "Marked";
  return (
    <div className="iv-next">
      <p>
        <b>
          {by} at turn {n.turn}
        </b>
        <span>
          It opens again when every home is back{n.when ? `, ${whenWords(n.when)}` : ""}. {back ? "Every home is here." : `Waiting on ${away.join(" and ")}.`}
        </span>
      </p>
      <button className="cx-btn iv-btn" data-bot="night-resume" disabled={!back} onClick={() => store.update((x) => resumeNightS(x, n.id))}>
        {back && <TvIcon size={20} />} <span>{back ? `Open at turn ${n.turn} on the TV` : `Opens when ${away.join(" and ")} are back`}</span>
      </button>
    </div>
  );
}

export function NightDetail({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  const us = n.homes.find((h) => h.householdId === US);
  const ribbon = n.status === "paused" ? ribbonWords(n) : null;
  return (
    <div className="iv-page">
      <InviteFront gameId={n.gameId} when={n.status === "live" ? "Tonight 8:00" : n.when} homes={cardHomes(n)} ribbon={ribbon} />
      <Next n={n} store={store} />
      <h2 className="iv-subh">The table</h2>
      <Table n={n} mode="status" />
      <h2 className="iv-subh">Turn the card over</h2>
      <InviteBack to={otherHomes(n).map((h) => h.name)} kidNames={s.nights.kidNames} seat={us?.colorName ?? "blue"}>
        <KidNamesSwitch s={s} store={store} />
      </InviteBack>
      {n.status !== "live" && (
        <button className="cx-btn iv-btn iv-btn--line iv-wide" data-bot="night-new-here" onClick={() => store.update((x) => night(x, beginNewNight))}>
          <Plus size={18} /> <span>Make a new card</span>
        </button>
      )}
    </div>
  );
}
