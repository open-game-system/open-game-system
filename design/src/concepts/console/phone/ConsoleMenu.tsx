// The console menu (the phone's Home button): pause this game and pick the next one.
// Picking a game IS the switch: the current game saves itself, and undo is one tap afterwards,
// so there is no confirm step.
import type { Store } from "../../../harness/store";
import { GAMES, HOME, gameById } from "../../../world";
import { closeMenu, nextLine, resumePoint, seatPlan, startSwitch, type S } from "../state";
import { couchStatus } from "../status";
import { Portrait } from "../ui/Brand";
import { Chip } from "../ui/Chip";
import { GameArt } from "../ui/GameArt";
import { Battery, Chevron } from "../ui/Icons";

export function ConsoleMenu({ s, store }: { s: S; store: Store<S> }) {
  const current = s.onTv;
  const next = GAMES.filter((g) => g.shape === "couch" && g.id !== current);
  const low = HOME.devices.find((d) => d.kind === "ipad" && (d.battery ?? 1) < 0.15);
  return (
    <div className="cx-sheetwrap">
      {current && (
        <div className="cx-menuart" aria-hidden>
          <GameArt gameId={current} />
        </div>
      )}
      <button className="cx-scrim" aria-label="Close menu" data-bot="menu-close" onClick={() => store.update(closeMenu)} />
      <div className="cx-sheet" role="dialog" aria-label="Console menu">
        <div className="cx-sheet__grab" />
        {current && (
          <div className="cx-sheet__now">
            <span className="cx-sheet__kicker">Paused on the TV</span>
            <b>
              {gameById(current).name} · {resumePoint(current)}
            </b>
            <span>Switching saves it here. Back to it any time tonight.</span>
          </div>
        )}
        <h3 className="cx-sheet__h">Play next on Living room TV</h3>
        {low && (
          <p className="cx-next__warn">
            <Battery size={20} level={low.battery ?? 0} /> {low.name} is at {Math.round((low.battery ?? 0) * 100)}%. It keeps its seat if it falls asleep.
          </p>
        )}
        <div className="cx-next">
          {next.map((g) => {
            const seats = seatPlan(g);
            return (
              <button key={g.id} className="cx-next__row" data-bot={`next-${g.id}`} onClick={() => store.update((x) => startSwitch(x, g.id))}>
                <span className="cx-next__art">
                  <GameArt gameId={g.id} alt />
                </span>
                <span className="cx-next__text">
                  <b>{g.name}</b>
                  <span>{nextLine(g.id)}</span>
                  <span className="cx-next__seats">
                    <Chip status={couchStatus(g.id, null, s.savedTonight)} />
                    {seats.map((x) => (
                      <Portrait key={x.person.id} person={x.person} size={20} />
                    ))}
                  </span>
                </span>
                <Chevron size={18} />
              </button>
            );
          })}
        </div>
        <div className="cx-sheet__foot">
          <button className="cx-btn cx-btn--ghost" data-bot="menu-console-home"><span>Console home on TV</span></button>
          <button className="cx-btn cx-btn--ghost" data-bot="menu-end"><span>End for tonight</span></button>
        </div>
      </div>
    </div>
  );
}
