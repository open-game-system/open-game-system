// A game night's page on the phone: the lobby table. One screen is the whole night; setting one up,
// playing, pausing, a home dropping and finishing are the same table in different states.
import type { Store } from "../../../../harness/store";
import { nightOpen } from "../../nights";
import { goHome, type S } from "../../state";
import { StatusBar } from "../../ui/Brand";
import { Chevron } from "../../ui/Icons";
import { InvitePreview } from "./InvitePreview";
import { LobbyTable } from "./LobbyTable";
import type { Drop } from "./table";

export function NightHeader({ store, title }: { store: Store<S>; title: string }) {
  return (
    <>
      <StatusBar dark />
      <div className="cx-topbar lt-topbar">
        <button className="cx-back" data-bot="night-back" onClick={() => store.update(goHome)}>
          <Chevron size={20} dir="left" /> Home
        </button>
        <span className="lt-topbar__title ogs-display">{title}</span>
      </div>
    </>
  );
}

export function NightPage({ s, store, drop = null }: { s: S; store: Store<S>; drop?: Drop | null }) {
  const n = nightOpen(s.nights);
  return (
    <div className="lt-wrap">
      <LobbyTable s={s} store={store} drop={drop} header={<NightHeader store={store} title={n ? "Hearthisle night" : "New Hearthisle night"} />} />
      {s.nights.preview && n && <InvitePreview n={n} s={s} store={store} />}
    </div>
  );
}
