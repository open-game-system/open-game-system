// "Who's here tonight": the couch roster. Everyone ticked gets a seat in whatever game starts, and
// their paired device joins by name. Nobody scans, nobody picks a role.
import type { Store } from "../../../harness/store";
import { HOME } from "../../../world";
import { toggleHere, type S } from "../state";
import { Portrait } from "../ui/Brand";
import { Check } from "../ui/Icons";

function deviceLine(personId: string): string {
  if (personId === "dad") return "This phone";
  const d = HOME.devices.find((x) => x.personId === personId && (x.kind === "ipad" || x.kind === "phone"));
  if (!d) return "Plays along on the TV";
  return d.kind === "ipad" ? `${d.name} · joins by name` : `${d.name} · joins by name`;
}

export function WhoSheet({ s, store }: { s: S; store: Store<S> }) {
  const close = () => store.update((x) => ({ ...x, who: false }));
  return (
    <div className="cx-sheetwrap">
      <button className="cx-scrim" aria-label="Close" onClick={close} />
      <div className="cx-sheet cx-sheet--dark" role="dialog" aria-label="Who's here tonight">
        <div className="cx-sheet__grab" />
        <h3 className="cx-who__h">Who's on the couch?</h3>
        <p className="cx-who__sub">Everyone ticked gets a seat in the next game. Their iPad joins on its own.</p>
        <ul className="cx-homes cx-who">
          {HOME.people.map((p) => {
            const on = s.here.includes(p.id);
            return (
              <li key={p.id}>
                <button className={`cx-homes__row cx-pick cx-who__row ${on ? "is-on" : ""}`} role="checkbox" aria-checked={on} data-bot={`here-${p.id}`} onClick={() => store.update((x) => toggleHere(x, p.id))}>
                  <Portrait person={p} size={40} dim={!on} />
                  <span className="cx-homes__text">
                    <b>{p.name}</b>
                    <span>{deviceLine(p.id)}</span>
                  </span>
                  <span className="cx-pick__box">{on && <Check size={18} />}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button className="cx-btn cx-btn--light cx-who__done" data-bot="who-done" onClick={close}>
          <span>{s.here.length} on the couch</span>
        </button>
      </div>
    </div>
  );
}
