// The console menu (the phone's Home button), Shelf swap: the phone is the hand at the shelf.
// The box in the console is open at the top (its resume point about to go on its spine); below,
// the shelf, every other game standing spine-out with its own resume point written on it.
// Taking a box down IS the switch: the open one is closed and put back in its place, and undo is
// one tap afterwards, so there is no confirm step.
import type { Store } from "../../../harness/store";
import { HOME, gameById } from "../../../world";
import { closeMenu, pointIn, seatPlan, startSwitch, type S } from "../state";
import { shelfOf, spineText } from "../shelf/model";
import { Spine, spineStyle } from "../shelf/Spine";
import { GameArt } from "../ui/GameArt";
import { Battery } from "../ui/Icons";

export function ConsoleMenu({ s, store }: { s: S; store: Store<S> }) {
  const current = s.onTv;
  const shelf = shelfOf(current);
  const low = HOME.devices.find((d) => d.kind === "ipad" && (d.battery ?? 1) < 0.15);
  return (
    <div className="cx-sheetwrap">
      <button className="cx-scrim" aria-label="Close menu" data-bot="menu-close" onClick={() => store.update(closeMenu)} />
      <div className="cx-sheet psh" role="dialog" aria-label="Console menu">
        <div className="cx-sheet__grab" />
        {current && (
          <div className="psh-open" style={spineStyle(current)}>
            <span className="psh-open__tray" aria-hidden>
              <GameArt gameId={current} />
            </span>
            <span className="psh-open__front">
              <span className="psh-k">In the console · paused</span>
              <b className="ogs-display">{gameById(current).name}</b>
              <span>
                {pointIn(s, current)} goes on its spine when you take another box down.
              </span>
            </span>
          </div>
        )}
        <h3 className="psh-h">The shelf · tap a box to take it down</h3>
        {low && (
          <p className="psh-warn">
            <Battery size={20} level={low.battery ?? 0} /> {low.name} is at {Math.round((low.battery ?? 0) * 100)}%. If it sleeps, Ava's seat waits in the box.
          </p>
        )}
        <div className="psh-shelf">
          {shelf.map((id) => (
            <button key={id} className="psh-shelf__box" data-bot={`next-${id}`} aria-label={`Take down ${gameById(id).name}`} onClick={() => store.update((x) => startSwitch(x, id))}>
              <Spine gameId={id} text={spineText(s, id)} people={seatPlan(gameById(id)).map((x) => x.person)} sticker={24} className="sp--phone" />
            </button>
          ))}
          <span className="psh-shelf__plank" aria-hidden />
        </div>
        <div className="cx-sheet__foot">
          <button className="cx-btn cx-btn--ghost" data-bot="menu-console-home"><span>Console home on TV</span></button>
          <button className="cx-btn cx-btn--ghost" data-bot="menu-end"><span>End for tonight</span></button>
        </div>
      </div>
    </div>
  );
}
