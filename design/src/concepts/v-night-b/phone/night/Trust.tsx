// The one trust decision on the back of the card: print Juneau's name for the other homes, or not.
// Off by default; reversible any time (it leaves every home's copy at once).
import type { Store } from "../../../../harness/store";
import type { S } from "../../state";

export function KidNamesSwitch({ s, store }: { s: S; store: Store<S> }) {
  const on = s.nights.kidNames;
  return (
    <label className="iv-switch">
      <span>
        <b>{on ? "Juneau's name is printed" : "Print Juneau's name"}</b>
        <span>{on ? "Turn off to take it off every home's copy, tonight's board too." : "Off. Turn it on, and back off, any time."}</span>
      </span>
      <input type="checkbox" role="switch" data-bot="kid-names" checked={on} onChange={() => store.update((x) => ({ ...x, nights: { ...x.nights, kidNames: !x.nights.kidNames } }))} />
    </label>
  );
}
