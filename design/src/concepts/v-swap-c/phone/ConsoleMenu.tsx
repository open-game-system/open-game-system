// Variant "Instant + receipt": the console button opens a quick-switch sheet, not a menu. Four big
// art tiles; tapping one IS the switch (the game on the TV saves itself, Back is on the receipt
// afterwards), so there is no confirm and no ceremony. The TV only pauses while this is open.
import type { Store } from "../../../harness/store";
import { GAMES, HOME, gameById } from "../../../world";
import { closeMenu, pointIn, startSwitch, type S } from "../state";
import { GameArt } from "../ui/GameArt";
import { Battery } from "../ui/Icons";

export function ConsoleMenu({ s, store }: { s: S; store: Store<S> }) {
  const current = s.onTv;
  const next = GAMES.filter((g) => g.shape === "couch" && g.id !== current);
  const low = HOME.devices.find((d) => d.kind === "ipad" && (d.battery ?? 1) < 0.15);
  return (
    <div className="cx-sheetwrap">
      <button className="cx-scrim" aria-label="Close menu" data-bot="menu-close" onClick={() => store.update(closeMenu)} />
      <div className="cx-sheet cx-qs" role="dialog" aria-label="Switch game">
        <div className="cx-sheet__grab" />
        <h3 className="cx-qs__h ogs-display">Switch to</h3>
        {current && (
          <p className="cx-qs__save">
            {gameById(current).name} saves at {pointIn(s, current).toLowerCase()}. Back is one tap.
          </p>
        )}
        <div className="cx-qs__grid">
          {next.map((g) => (
            <button key={g.id} className="cx-qs__tile" data-bot={`next-${g.id}`} onClick={() => store.update((x) => startSwitch(x, g.id))}>
              <span className="cx-qs__art">
                <GameArt gameId={g.id} alt />
              </span>
              <span className="cx-qs__text">
                <b>{g.name}</b>
                <span>{s.savedTonight[g.id] ? `Saved ${s.savedTonight[g.id]}` : pointIn(s, g.id)}</span>
              </span>
            </button>
          ))}
        </div>
        {low && (
          <p className="cx-qs__warn">
            <Battery size={20} level={low.battery ?? 0} /> {low.name} {Math.round((low.battery ?? 0) * 100)}% · keeps its seat if it sleeps
          </p>
        )}
        <div className="cx-sheet__foot">
          <button className="cx-btn cx-btn--ghost" data-bot="menu-console-home"><span>Console home</span></button>
          <button className="cx-btn cx-btn--ghost" data-bot="menu-end"><span>End for tonight</span></button>
        </div>
      </div>
    </div>
  );
}
