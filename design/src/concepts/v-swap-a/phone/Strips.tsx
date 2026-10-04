// Console strips: one line between the OGS bar and the game. Never inside the game's view.
import type { Store } from "../../../harness/store";
import { HOME, gameById } from "../../../world";
import { saveOf, seatPlan, undoSwitch, type S } from "../state";
import { spineText } from "../shelf/model";
import { Spine } from "../shelf/Spine";
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
  const fresh = s.fresh[onTv];
  if (fresh && !s.left) {
    const save = saveOf(onTv);
    return (
      <div className="cx-strip" role="status">
        <span className="cx-strip__text">
          <b>New {game.name} started</b>
          <span>{fresh === "keep" ? `${save?.point ?? "The old save"} is kept as a second save. Continue lists both.` : `${save?.point ?? "The old save"} was replaced.`}</span>
        </span>
        <Check size={22} />
      </div>
    );
  }
  if (s.left) {
    // Shelf swap: the box you just put away, on the shelf with its resume point on the spine.
    // Tapping the spine takes it back down (the undo); after an undo, the other box is shelved.
    const left = gameById(s.left.gameId);
    const text = spineText(s, left.id);
    if (!s.left.undone) {
      return (
        <button className="cx-strip psh-undo" data-bot="undo-switch" aria-label={`Take ${left.name} back down`} onClick={() => store.update(undoSwitch)}>
          <span className="psh-undo__row">
            <span className="psh-undo__k">On the shelf</span>
            <span className="psh-undo__go"><Undo size={18} /> Back to it</span>
          </span>
          <Spine gameId={left.id} text={text} className="sp--phone" />
        </button>
      );
    }
    return (
      <div className="cx-strip psh-undo psh-undo--done" role="status">
        <span className="psh-undo__k">Back on the shelf</span>
        <Spine gameId={left.id} text={text} className="sp--phone" tail={<span className="psh-undo__ok"><Check size={18} /></span>} />
      </div>
    );
  }
  return null;
}
