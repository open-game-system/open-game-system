// First time: the channel is off air. One action puts it on: choose the TV. Everything else waits.
import type { Store } from "../../../harness/store";
import { HOME } from "../../../world";
import { StatusBar } from "../brand/PhoneTop";
import { Bars } from "../brand/Mark";
import type { S } from "../state";

export function FirstRun({ store }: { store: Store<S> }) {
  const tv = HOME.devices.find((d) => d.kind === "tv" && d.online);
  return (
    <div className="ch-phone ch-first">
      <StatusBar dark />
      <div className="ch-first-card">
        <div className="ch-testcard" aria-hidden="true">
          <Bars height={150} width={44} gap={10} />
        </div>
        <span className="ch-first-off"><span>Off air</span></span>
        <h1>
          Your family's channel
          <br />
          starts on the TV.
        </h1>
        <p>Cast once and tonight becomes a running order: games play one after another, saved where you stop, and the kids' iPads follow along by themselves.</p>
      </div>
      <ul className="ch-first-list">
        <li>
          <b>4 people</b> · Jonathan, Mom, Juneau, Ava
        </li>
        <li>
          <b>2 kid iPads</b> · paired once, never asked again
        </li>
        <li>
          <b>{tv?.name}</b> · found on your Wi-Fi
        </li>
      </ul>
      <footer className="ch-dock ch-dock-flat">
        <button className="ch-primary" data-bot="go-on-air" onClick={() => store.update((x) => ({ ...x, tv: "continuity", phone: "home" }))}>
          <span>Go on air on the {tv?.name}</span>
        </button>
      </footer>
    </div>
  );
}
