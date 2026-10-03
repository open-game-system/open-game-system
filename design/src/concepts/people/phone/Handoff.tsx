// The swap, told as it happens: the old game saves, the TV cuts over, each device follows by name.
import { gameById, HOME, type OwnedDevice } from "../../../world";
import type { Store } from "../../../harness/store";
import { goBack, type S } from "../state";
import { Patch } from "../ui/Patch";
import { IconBattery, IconCheck, IconPhone, IconTablet, IconTv, IconUndo } from "../ui/Icons";
import { pickUp, seatFor } from "../ui/seats";

type Step = "wait" | "busy" | "done" | "asleep";

function Mark({ step }: { step: Step }) {
  if (step === "done") return <span className="pf-mark done"><IconCheck size={18} /></span>;
  if (step === "busy") return <span className="pf-mark busy" aria-label="in progress" />;
  if (step === "asleep") return <span className="pf-mark asleep"><IconBattery level={0.09} size={18} /></span>;
  return <span className="pf-mark" />;
}

export function Handoff({ s, store }: { s: S; store: Store<S> }) {
  const c = s.couch;
  const next = c.gameId ? gameById(c.gameId) : undefined;
  const left = c.left ? gameById(c.left.gameId) : undefined;
  if (!next) return null;
  const order = ["saving", "cutover", "following", "playing"];
  const at = order.indexOf(c.phase);
  const saveStep: Step = at === 0 ? "busy" : "done";
  const tvStep: Step = at < 1 ? "wait" : at === 1 ? "busy" : "done";
  const devices = HOME.devices.filter((d) => d.kind === "phone" ? d.personId === "dad" : d.kind === "ipad");
  const devStep = (d: OwnedDevice): Step => {
    if (d.kind === "phone") return at >= 1 ? "done" : "wait";
    const who = d.personId ?? "";
    if (who === "ava" && c.avaAsleep && at >= 2) return "asleep";
    if (c.arrived.includes(who)) return "done";
    return at >= 2 ? "busy" : "wait";
  };
  return (
    <div className="pf-handoff">
      <div className="pf-handoff-cards">
        {left && (
          <div className="pf-handoff-old">
            <img src={left.art.tv} alt="" />
            <div>
              <p className="pf-gcard-name">{left.name}</p>
              <p className="pf-handoff-line">
                <Mark step={saveStep} /> {saveStep === "busy" ? `Saving ${c.left?.savedAt}…` : `Saved at ${c.left?.savedAt}`}
              </p>
            </div>
          </div>
        )}
        <div className="pf-handoff-new">
          <img src={next.art.tv} alt="" />
          <div className="pf-handoff-cap">
            <p className="pf-gcard-name">Up next</p>
            <h3>{next.name}</h3>
            <p>Picking up at {pickUp(next.id)}</p>
          </div>
        </div>
      </div>
      <ul className="pf-follow">
        <li>
          <span className="pf-follow-dev"><IconTv size={20} /></span>
          <span className="pf-follow-main">
            <b>Living room TV</b>
            <span>{tvStep === "done" ? `Showing ${next.name}` : tvStep === "busy" ? "Cutting over…" : "Waiting for the save"}</span>
          </span>
          <Mark step={tvStep} />
        </li>
        {devices.map((d) => {
          const p = HOME.people.find((x) => x.id === d.personId);
          const st = devStep(d);
          return (
            <li key={d.id}>
              {p ? <Patch person={p} size={36} dim={st === "asleep"} /> : null}
              <span className="pf-follow-main">
                <b>
                  {d.name} {d.kind === "phone" ? <IconPhone size={15} /> : <IconTablet size={15} />}
                </b>
                <span>{st === "asleep" ? "Asleep at 9% · waits for her" : p ? `${st === "done" ? "In as" : "Following as"} ${seatFor(next.id, p)}` : ""}</span>
              </span>
              <Mark step={st} />
            </li>
          );
        })}
      </ul>
      {left && (
        <button className="pf-link" style={{ alignSelf: "center" }} data-bot="undo-swap" onClick={() => store.update(goBack)}>
          <IconUndo /> Back to {left.name}
        </button>
      )}
    </div>
  );
}
