// Console strips: one line between the OGS bar and the game. Never inside the game's view.
import type { Store } from "../../../harness/store";
import { HOME, gameById } from "../../../world";
import { resumePoint, seatPlan, undoSwitch, type S } from "../state";
import { Portrait } from "../ui/Brand";
import { Battery, Bell, Check, Undo } from "../ui/Icons";

export function Strips({ s, store }: { s: S; store: Store<S> }) {
  const onTv = s.onTv;
  if (!onTv) return null;
  const game = gameById(onTv);
  const sleeping = seatPlan(game).find((x) => x.device && s.asleep.includes(x.device.id));
  if (sleeping?.device) {
    const d = sleeping.device;
    return (
      <div className="cx-strip cx-strip--warn" role="status">
        <span className="cx-strip__icon">
          <Battery size={24} level={d.battery ?? 0} />
        </span>
        <span className="cx-strip__text">
          <b>
            {d.name} is asleep · {Math.round((d.battery ?? 0) * 100)}%
          </b>
          <span>
            {sleeping.person.name}'s {sleeping.role.label.toLowerCase()} seat is saved. It joins the moment it wakes.
          </span>
        </span>
        <button className="cx-btn cx-btn--sm cx-btn--dark" data-bot="ring-device" disabled={s.rung} onClick={() => store.update((x) => ({ ...x, rung: true }))}>
          {s.rung ? (
            <span>Ringing</span>
          ) : (
            <>
              <Bell size={16} /> <span>Ring it</span>
            </>
          )}
        </button>
      </div>
    );
  }
  if (s.lateJoin) {
    const p = HOME.people.find((x) => HOME.devices.some((d) => d.id === s.lateJoin && d.personId === x.id));
    const seat = p ? seatPlan(game).find((x) => x.person.id === p.id) : undefined;
    if (p && seat) {
      return (
        <div className="cx-strip cx-strip--ok" role="status">
          <Portrait person={p} size={30} />
          <span className="cx-strip__text">
            <b>{p.name}'s in</b>
            <span>
              Her iPad woke up and went straight to {seat.role.label.toLowerCase()}.
            </span>
          </span>
          <Check size={22} />
        </div>
      );
    }
  }
  if (s.left && !s.left.undone) {
    const left = gameById(s.left.gameId);
    return (
      <div className="cx-strip" role="status">
        <span className="cx-strip__text">
          <b>
            {left.name} saved at {resumePoint(left.id).toLowerCase()}
          </b>
          <span>Everyone moved to {game.name}.</span>
        </span>
        <button className="cx-btn cx-btn--sm cx-btn--dark" data-bot="undo-switch" onClick={() => store.update(undoSwitch)}>
          <Undo size={16} /> <span>Back to it</span>
        </button>
      </div>
    );
  }
  if (s.left && s.left.undone) {
    const left = gameById(s.left.gameId);
    return (
      <div className="cx-strip" role="status">
        <span className="cx-strip__text">
          <b>
            Back on {game.name} · {resumePoint(game.id).toLowerCase()}
          </b>
          <span>
            {left.name} kept {resumePoint(left.id).toLowerCase()} for later, in Jump back in.
          </span>
        </span>
        <Check size={22} />
      </div>
    );
  }
  return null;
}
