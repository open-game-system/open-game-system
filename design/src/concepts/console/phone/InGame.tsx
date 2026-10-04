// Phone while a game is on the TV: a thin console bar (Home button, what's on, who's in), then the
// game's own controller. The Home button is the only way out, like a console's.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { GamePhoneView } from "../games/registry";
import { hereTonight, openMenu, pointIn, seatPlan, type S } from "../state";
import { Mark, Portrait, StatusBar } from "../ui/Brand";
import { ConsoleMenu } from "./ConsoleMenu";
import { Strips } from "./Strips";
import { Switching } from "./Switching";
import { Casting } from "./Casting";

export function InGame({ s, store }: { s: S; store: Store<S> }) {
  const sw = s.switching;
  const gameId = sw ? sw.from : s.onTv;
  if (!gameId) return null;
  const g = gameById(gameId);
  const seats = seatPlan(g, hereTonight(s));
  return (
    <div className={`cx-ingame ${s.menu && !sw ? "has-menu" : ""}`}>
      <StatusBar dark />
      <div className="cx-bar">
        <button className="cx-bar__home" data-bot="console-home" aria-label="Console menu" onClick={() => store.update(openMenu)}>
          <Mark size={26} />
        </button>
        <div className="cx-bar__what">
          <b>{s.cast === "connecting" ? "Starting tonight" : sw ? "Switching games" : g.name}</b>
          <span>
            <span className="cx-live-dot" /> Living room TV{sw ? "" : ` · ${pointIn(s, g.id)}`}
          </span>
        </div>
        <div className="cx-bar__who">
          {seats.map((x) => (
            <Portrait key={x.person.id} person={x.person} size={26} dim={!!x.device && s.asleep.includes(x.device.id)} />
          ))}
        </div>
      </div>
      {s.cast === "connecting" ? (
        <Casting s={s} gameId={gameId} />
      ) : sw ? (
        <Switching sw={sw} asleep={s.asleep} store={store} />
      ) : (
        <>
          <Strips s={s} store={store} />
          <div className="cx-gameview">
            <GamePhoneView gameId={gameId} />
          </div>
        </>
      )}
      {s.menu && !sw && <ConsoleMenu s={s} store={store} />}
    </div>
  );
}
