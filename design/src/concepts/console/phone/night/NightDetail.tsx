// One game night: the board's art, the homes on the follow path, where it stands, and the one
// thing to do next (resume when everyone's back · controller on our roll · pause for tonight).
import type { Store } from "../../../../harness/store";
import { gameById } from "../../../../world";
import { beginNewNight, everyoneBack, homeName, nightLine, nightStatus, short, US, type Night } from "../../nights";
import { night, pauseNightS, resumeNightS, type S } from "../../state";
import { Chip } from "../../ui/Chip";
import { GameArt } from "../../ui/GameArt";
import { HomesPath } from "../../ui/HomesPath";
import { Gamepad, Plus, TvIcon } from "../../ui/Icons";
import { HomeRows } from "./HomeRows";
import { Trust } from "./Trust";

function Next({ n, s, store }: { n: Night; s: S; store: Store<S> }) {
  if (n.status === "live") {
    const ours = n.turnOf === US;
    return (
      <div className="cx-nextbox">
        <p>
          <b>{ours ? "Your roll" : `${short(homeName(n, n.turnOf))} are rolling`}</b>
          {ours ? " · on the living room TV. Juneau shares the blue seat." : ". Your roll comes next; we'll put it in Your turn."}
        </p>
        <div className="cx-nextbox__actions">
          <button className="cx-btn cx-btn--light" data-bot="night-controller" onClick={() => store.update((x) => ({ ...x, phone: "controller" }))}>
            <Gamepad size={20} /> <span>Controller</span>
          </button>
          <button className="cx-btn cx-btn--line" data-bot="night-pause" onClick={() => store.update((x) => pauseNightS(x, n.id))}>
            <span>Pause for tonight</span>
          </button>
        </div>
      </div>
    );
  }
  const back = everyoneBack(n);
  const away = n.homes.filter((h) => !h.back).map((h) => short(h.name));
  return (
    <div className="cx-nextbox">
      <p>
        <b>Paused at turn {n.turn}.</b> Resumes when everyone's back{n.when ? `, ${n.when.toLowerCase()}` : ""}.{" "}
        {back ? "Every home is here." : `Waiting on ${away.join(" and ")}.`}
      </p>
      <button className="cx-btn cx-btn--light" data-bot="night-resume" disabled={!back} onClick={() => store.update((x) => resumeNightS(x, n.id))}>
        <TvIcon size={20} /> <span>{back ? `Resume turn ${n.turn} on the TV` : `Resume when ${away.join(" and ")} are back`}</span>
      </button>
    </div>
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
