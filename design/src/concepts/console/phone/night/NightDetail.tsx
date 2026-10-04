// One game night: the board's art, the homes on the follow path, where it stands, and the one
// thing to do next (resume when everyone's back · controller on our roll · pause for tonight).
import type { Store } from "../../../../harness/store";
import { gameById } from "../../../../world";
import { beginNewNight, everyoneBack, homeName, household, nightLine, nightStatus, otherHomes, short, US, type Night, whenWords } from "../../nights";
import { Crest } from "../../ui/Sticker";
import { night, pauseNightS, resumeNightS, type S } from "../../state";
import { Chip } from "../../ui/Chip";
import { GameArt } from "../../ui/GameArt";
import { HomesPath } from "../../ui/HomesPath";
import { Gamepad, Plus, TvIcon } from "../../ui/Icons";
import { HomeRows } from "./HomeRows";
import { Trust } from "./Trust";

function Next({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  const others = otherHomes(n);
  const otherNames = others.map((h) => short(h.name)).join(" and ");
  if (n.status === "live") {
    const ours = n.turnOf === US;
    return (
      <div className="cx-nextbox">
        <p>
          <b>{ours ? "Your roll, on the living room TV" : `${short(homeName(n, n.turnOf))} are rolling`}</b>
          <span>{ours ? "Juneau shares the blue seat with you." : "Your roll comes next. It will show up in Your turn."}</span>
        </p>
        <div className="cx-nextbox__actions">
          <button className="cx-btn cx-btn--light" data-bot="night-controller" onClick={() => store.update((x) => ({ ...x, phone: "controller" }))}>
            <Gamepad size={20} /> <span>Controller</span>
          </button>
          <button className="cx-btn cx-btn--line" data-bot="night-pause" onClick={() => store.update((x) => pauseNightS(x, n.id))}>
            <span>Pause for all {n.homes.length} homes</span>
          </button>
        </div>
        <p className="cx-nextbox__note">A pause stops the board for {otherNames} too. Everyone's seat and hand are kept; it picks up next Friday 8:00 when every home is back.</p>
      </div>
    );
  }
  const back = everyoneBack(n);
  const away = n.homes.filter((h) => !h.back).map((h) => short(h.name));
  const by = n.pausedBy === US ? "You paused it" : n.pausedBy ? `${short(homeName(n, n.pausedBy))} paused it` : "Paused";
  return (
    <div className="cx-nextbox">
      <p>
        <b>
          {by} at turn {n.turn}, for every home
        </b>
        <span>
          Resumes when everyone's back{n.when ? `, ${whenWords(n.when)}` : ""}. {back ? "Every home is here." : `Waiting on ${away.join(" and ")}.`}
        </span>
      </p>
      <button className="cx-btn cx-btn--light" data-bot="night-resume" disabled={!back} onClick={() => store.update((x) => resumeNightS(x, n.id))}>
        <TvIcon size={20} /> <span>{back ? `Resume turn ${n.turn} on the TV` : `Resume when ${away.join(" and ")} are back`}</span>
      </button>
      {n.pausedBy === US && <TheirView n={n} />}
    </div>
  );
}

/** What the other homes' phones say after our pause: the same night, from their side. */
function TheirView({ n }: { n: Night }) {
  const them = otherHomes(n)[0];
  if (!them) return null;
  return (
    <figure className="cx-theirview">
      <figcaption>What {otherHomes(n).map((h) => short(h.name)).join(" and ")} see</figcaption>
      <div className="cx-theirview__card">
        <Crest household={household(US)} size={40} shared />
        <span>
          <b>The Mumms paused game night</b>
          <span>
            {gameById(n.gameId).name} · turn {n.turn} · picks up {whenWords(n.when)}. Your seat and hand are saved.
          </span>
        </span>
      </div>
    </figure>
  );
}

export function NightDetail({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  const us = n.homes.find((h) => h.householdId === US);
  return (
    <div className="cx-night">
      <header className="cx-night__hero">
        <GameArt gameId={n.gameId} />
        <div className="cx-night__heroText">
          <Chip status={nightStatus(n, s.onTv)} />
          <h1>{gameById(n.gameId).name}</h1>
          <p>{nightLine(n)}</p>
        </div>
      </header>
      <HomesPath night={n} />
      <Next n={n} s={s} store={store} />
      <h2 className="cx-subh">Homes at this table</h2>
      <HomeRows n={n} store={store} mode="status" />
      <Trust s={s} store={store} us={us} />
      {n.status !== "live" && (
        <button className="cx-btn cx-btn--line cx-night__new" data-bot="night-new-here" onClick={() => store.update((x) => night(x, beginNewNight))}>
          <Plus size={18} /> <span>New game night</span>
        </button>
      )}
    </div>
  );
}
