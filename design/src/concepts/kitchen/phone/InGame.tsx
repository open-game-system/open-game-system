// In a game: Porchlight keeps one slim walnut bar (which TV, which game, Switch); below it the
// game's own controller page owns the screen. During a swap the controller is replaced by the
// "who followed" checklist; after it, a note with undo.
import type { Store } from "../../../harness/store";
import { gameById, resumePoint } from "../household";
import { StatusBar } from "../ui/Bits";
import { Lamp, Swap, Undo } from "../ui/Icons";
import { phoneController } from "../games/registry";
import { SwitchProgress } from "./SwitchProgress";
import { Switcher } from "./Switcher";
import { startSwitch, type S } from "../state";

export function InGame({ s, store }: { s: S; store: Store<S> }) {
  const t = s.tonight;
  const gameId = t.kind === "playing" ? t.gameId : t.kind === "switching" ? t.to : null;
  if (!gameId) return null;
  const game = gameById(gameId);
  const Controller = phoneController(gameId);
  const switching = t.kind === "switching";
  return (
    <div className="pl pl-phone pl-ingame" style={{ background: switching ? "var(--pl-paper)" : game.palette.ground }}>
      <StatusBar time={s.clock} dark />
      <div className="pl-gamebar">
        <button className="pl-gamebar-home" data-bot="home" aria-label="Tonight" onClick={() => store.update((x) => ({ ...x, phone: "home" }))}>
          <Lamp size={26} />
        </button>
        <div className="pl-gamebar-title">
          <span>Living room TV</span>
          <b>{switching ? "Switching…" : game.name}</b>
        </div>
        {!switching && (
          <button className="pl-btn pl-btn--bar" data-bot="switch-game" onClick={() => store.update((x) => ({ ...x, sheet: "switcher" }))}>
            <span>
              {" "}
              <Swap size={18} /> Switch
            </span>
          </button>
        )}
      </div>
      {t.kind === "playing" && t.after && <AfterNote s={s} store={store} from={t.after.from} undone={t.after.undone} />}
      <div className="pl-gameview">{switching ? <SwitchProgress s={s} /> : <Controller />}</div>
      {s.sheet === "switcher" && <Switcher s={s} store={store} />}
    </div>
  );
}

function AfterNote({ s, store, from, undone }: { s: S; store: Store<S>; from: string; undone: boolean }) {
  const prev = gameById(from);
  const missing = s.avaAsleep && !s.avaCaughtUp && !undone;
  return (
    <div className={`pl-after${missing ? " pl-after--warn" : ""}`} role="status">
      <div className="pl-after-text">
        {missing ? (
          <>
            <b>Ava's iPad is asleep at 9%.</b>
            <span>Plug it in; it joins her seat when it wakes.</span>
          </>
        ) : s.avaCaughtUp ? (
          <>
            <b>Ava's iPad caught up.</b>
            <span>Everyone's in their seat.</span>
          </>
        ) : (
          <>
            <b>
              {undone ? `Back on ${resumePoint(gameById(s.tonight.kind === "playing" ? s.tonight.gameId : from).id).toLowerCase()}.` : "Everyone followed."}
            </b>
            <span>
              {prev.name} saved at {resumePoint(from).toLowerCase()}.
            </span>
          </>
        )}
      </div>
      {!undone && (
        <button className="pl-btn pl-btn--undo" data-bot="undo" onClick={() => store.update((x) => startSwitch(x, from, true))}>
          <span>
            {" "}
            <Undo size={18} /> Back to {prev.name}
          </span>
        </button>
      )}
    </div>
  );
}
